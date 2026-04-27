"use client";
import React, { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import Canvas, { CanvasHandle } from "@/components/ui/Canvas";
import { DrawingProvider } from "@/context/DrawingContext";
import Toolbar from "@/components/ui/Toolbar";

type Stage = "idle" | "recognizing" | "solving" | "done" | "error";

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export default function Page() {
  const canvasRef = useRef<CanvasHandle | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [latexInput, setLatexInput] = useState<string | null>(null);
  const [latexResult, setLatexResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strokeBounds, setStrokeBounds] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);
  const [usage, setUsage] = useState<{ recognize: TokenUsage; solve: TokenUsage }>({
    recognize: {},
    solve: {},
  });

  // Live stroke stats badge
  const [strokeStats, setStrokeStats] = useState({ strokes: 0, points: 0, bytes: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      const strokes = canvasRef.current?.getStrokes() ?? [];
      const points = strokes.reduce((s, st) => s + st.length, 0);
      const bytes = new TextEncoder().encode(JSON.stringify(strokes)).length;
      setStrokeStats({ strokes: strokes.length, points, bytes });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const clearCanvas = () => {
    const context = canvasRef.current?.getContext();
    if (context) {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    canvasRef.current?.clearStrokes();
    setStage("idle");
    setLatexInput(null);
    setLatexResult(null);
    setError(null);
    setStrokeBounds(null);
    setUsage({ recognize: {}, solve: {} });
  };

  // Downscale to max 800px wide + encode as JPEG to keep payload under ~100KB
  // Uses canvas.width (actual pixels) so it works for both DOM and offscreen canvases
  const captureImage = (canvas: HTMLCanvasElement): string => {
    const srcW = canvas.width || canvas.clientWidth;
    const srcH = canvas.height || canvas.clientHeight;
    const maxW = 800;
    const scale = Math.min(1, maxW / srcW);
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    off.getContext("2d")!.drawImage(canvas, 0, 0, w, h);
    return off.toDataURL("image/jpeg", 0.85);
  };

  const sendCanvasData = async () => {
    const context = canvasRef.current?.getContext();
    if (!context) return;

    // ── Composite into an offscreen canvas for capture only ──────────────
    // Main canvas + KaTeX DOM overlay stay untouched visually.
    // Offscreen = previous answer (stamp) + new strokes on top.
    const mainCanvas = context.canvas;
    const offscreen = document.createElement("canvas");
    offscreen.width = mainCanvas.clientWidth;
    offscreen.height = mainCanvas.clientHeight;
    const offCtx = offscreen.getContext("2d")!;

    if (latexInput && latexResult && strokeBounds) {
      const fontSize = Math.min(Math.max(strokeBounds.height * 0.6, 24), 72);
      offCtx.font = `${fontSize}px serif`;
      offCtx.fillStyle = "white";
      offCtx.fillText(
        buildDisplayLatex(latexInput, latexResult),
        strokeBounds.x,
        strokeBounds.y + strokeBounds.height * 0.75
      );
    }
    // Draw the actual canvas strokes on top of the stamp
    offCtx.drawImage(mainCanvas, 0, 0, mainCanvas.clientWidth, mainCanvas.clientHeight);

    const image = captureImage(offscreen);

    // ── Stage 1: Image → LaTeX ────────────────────────────────────────────
    // Keep previous overlay visible the whole time; only replace atomically at the end
    setStage("recognizing");
    setError(null);

    let recognizedLatex: string;
    try {
      const r1 = await fetch("/api/strokes-to-latex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.message ?? "Stage 1 failed");
      recognizedLatex = d1.latex as string;
      setUsage((u) => ({ ...u, recognize: d1.usage ?? {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recognition failed");
      setStage("error");
      return;
    }

    // ── Stage 2: LaTeX → Solved LaTeX ────────────────────────────────────
    setStage("solving");

    let solvedResult: string;
    try {
      const r2 = await fetch("/api/latex-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: recognizedLatex }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.message ?? "Stage 2 failed");
      solvedResult = d2.result as string;
      setUsage((u) => ({ ...u, solve: d2.usage ?? {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solve failed");
      setStage("error");
      return;
    }

    // ── Compute new bounding box (union of old bounds + new strokes) ──────
    const newStrokes = canvasRef.current?.getStrokes() ?? [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Include old bounds so the overlay covers the full expression
    if (strokeBounds) {
      minX = Math.min(minX, strokeBounds.x);
      minY = Math.min(minY, strokeBounds.y);
      maxX = Math.max(maxX, strokeBounds.x + strokeBounds.width);
      maxY = Math.max(maxY, strokeBounds.y + strokeBounds.height);
    }
    for (const stroke of newStrokes) {
      for (const [x, y] of stroke) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    const pad = 16;
    const newBounds = isFinite(minX)
      ? { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
      : null;

    // ── Clear canvas and atomically replace overlay ───────────────────────
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    canvasRef.current?.clearStrokes();

    setLatexInput(recognizedLatex);
    setLatexResult(solvedResult);
    setStrokeBounds(newBounds);
    setStage("done");
  };

  // Build the full display expression: substitute answer for ? or append after =
  const buildDisplayLatex = (input: string, result: string): string => {
    if (input.includes("?")) return input.replace("?", result);
    if (input.trimEnd().endsWith("=")) return input + " " + result;
    return input + " = " + result;
  };

  // Render LaTeX safely; fall back to raw string on KaTeX parse error
  const renderLatex = (latex: string) => {
    try {
      return katex.renderToString(latex, { throwOnError: true, displayMode: true });
    } catch {
      return katex.renderToString(latex, { throwOnError: false, displayMode: true });
    }
  };

  const totalIn =
    (usage.recognize.prompt_tokens ?? 0) + (usage.solve.prompt_tokens ?? 0);
  const totalOut =
    (usage.recognize.completion_tokens ?? 0) + (usage.solve.completion_tokens ?? 0);

  return (
    <DrawingProvider>
      {/* Toolbar */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Toolbar clearCanvas={clearCanvas} sendCanvasData={sendCanvasData} />
      </div>

      {/* Stroke stats badge */}
      <div className="fixed bottom-4 left-4 z-50 text-xs text-white/50 font-mono bg-black/40 rounded px-2 py-1 select-none">
        {strokeStats.strokes} strokes · {strokeStats.points} pts · {strokeStats.bytes} B
      </div>

      {/* KaTeX result overlay — positioned at stroke bounding box */}
      {latexInput && latexResult && latexResult !== "?" && strokeBounds && (
        <div
          className="fixed z-20 pointer-events-none flex items-center"
          style={{
            left: strokeBounds.x,
            top: strokeBounds.y,
            width: strokeBounds.width,
            minHeight: strokeBounds.height,
            fontSize: Math.min(Math.max(strokeBounds.height * 0.6, 24), 72),
          }}
        >
          <div
            className="text-white drop-shadow-2xl"
            dangerouslySetInnerHTML={{
              __html: renderLatex(buildDisplayLatex(latexInput, latexResult)),
            }}
          />
        </div>
      )}

      {/* Side panel: pipeline steps + token usage */}
      {stage !== "idle" && (
        <div className="fixed right-4 top-20 z-50 w-72 bg-zinc-900/95 border border-white/10 rounded-xl p-4 shadow-2xl text-sm text-white space-y-3">

          {/* Step 1 */}
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Step 1 — Recognized</p>
            {stage === "recognizing" ? (
              <p className="text-white/50 animate-pulse">Reading strokes…</p>
            ) : latexInput ? (
              <div
                className="text-green-300"
                dangerouslySetInnerHTML={{ __html: renderLatex(latexInput) }}
              />
            ) : null}
          </div>

          {/* Step 2 */}
          {(stage === "solving" || stage === "done" || stage === "error") && (
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Step 2 — Result</p>
              {stage === "solving" ? (
                <p className="text-white/50 animate-pulse">Solving…</p>
              ) : latexResult ? (
                <div
                  className="text-yellow-300"
                  dangerouslySetInnerHTML={{ __html: renderLatex(latexResult) }}
                />
              ) : null}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          {/* Token usage */}
          {stage === "done" && (
            <div className="text-white/30 text-xs border-t border-white/10 pt-2 space-y-0.5 font-mono">
              <p>recognize: {usage.recognize.prompt_tokens ?? "—"} in / {usage.recognize.completion_tokens ?? "—"} out</p>
              <p>solve: {usage.solve.prompt_tokens ?? "—"} in / {usage.solve.completion_tokens ?? "—"} out</p>
              <p className="text-white/50">total: {totalIn} in / {totalOut} out</p>
            </div>
          )}
        </div>
      )}

      <Canvas ref={canvasRef} />
    </DrawingProvider>
  );
}
