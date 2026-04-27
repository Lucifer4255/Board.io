import { NextResponse } from "next/server";

interface RecognizePayload {
  strokes: [number, number][][];
  canvasWidth: number;
  canvasHeight: number;
}

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: OpenRouterUsage;
}

export async function POST(req: Request) {
  try {
    const { strokes, canvasWidth, canvasHeight } =
      (await req.json()) as RecognizePayload;

    if (!strokes?.length) {
      return NextResponse.json(
        { message: "No strokes provided — draw something first." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    // Normalize coordinates to 0-1 range (4 decimal places keeps JSON compact)
    const normalized = strokes.map((stroke) =>
      stroke.map(([x, y]): [number, number] => [
        parseFloat((x / canvasWidth).toFixed(4)),
        parseFloat((y / canvasHeight).toFixed(4)),
      ])
    );

    const strokeJSON = JSON.stringify(normalized);
    const byteSize = new TextEncoder().encode(strokeJSON).length;

    const model =
      process.env.OPENROUTER_RECOGNIZE_MODEL ?? "openrouter/free";

    const prompt =
      `You are a handwriting recognizer. The user drew on a ${canvasWidth}x${canvasHeight} canvas.\n` +
      `Strokes as JSON (normalized 0-1 coordinates, origin top-left, x→right, y→down; each stroke = array of [x,y] points):\n` +
      `${strokeJSON}\n` +
      `What letter, word, number, or symbol was drawn?\n` +
      `Reply format:\n` +
      `Recognized: <guess>\n` +
      `Confidence: high | medium | low\n` +
      `Reason: <one line>`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return NextResponse.json(
        { message: "OpenRouter request failed", status: resp.status, body },
        { status: 502 }
      );
    }

    const completion = (await resp.json()) as OpenRouterResponse;
    const result = completion.choices?.[0]?.message?.content ?? "";
    const usage = completion.usage;

    console.log("[recognize]", {
      model: completion.model ?? model,
      strokes: strokes.length,
      byteSize,
      usage,
    });

    return NextResponse.json({ result, usage, model: completion.model ?? model });
  } catch (err) {
    console.error("[recognize] error:", err);
    return NextResponse.json({ message: "Recognition failed" }, { status: 500 });
  }
}
