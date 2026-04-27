import { NextResponse } from "next/server";

export const maxDuration = 30;

interface LatexSolvePayload {
  latex: string;
}

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export async function POST(req: Request) {
  try {
    const { latex } = (await req.json()) as LatexSolvePayload;

    if (!latex?.trim()) {
      return NextResponse.json({ message: "No LaTeX provided." }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "Missing OPENROUTER_API_KEY" }, { status: 500 });
    }

    const model = process.env.OPENROUTER_SOLVE_MODEL ?? "openrouter/free";

    const prompt =
      `You are a math solver. Evaluate or simplify the following LaTeX expression.\n` +
      `LaTeX input: ${latex}\n\n` +
      `Rules:\n` +
      `- Output ONLY the result as a raw LaTeX string. No explanation, no markdown, no $...$ wrappers.\n` +
      `- If it is an arithmetic expression, compute the numeric result.\n` +
      `- If it is an equation, solve for the unknown variable and express the answer as LaTeX.\n` +
      `- If it is a calculus expression (derivative, integral), evaluate it.\n` +
      `- Preserve LaTeX formatting in the answer (fractions, exponents, etc.).\n` +
      `- If unsolvable or unrecognized, output: ?\n` +
      `Example: input "2 + 2" → output "4"\n` +
      `Example: input "\\frac{d}{dx}x^3" → output "3x^2"\n` +
      `Example: input "\\int x^2 dx" → output "\\frac{x^3}{3} + C"`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const body = await resp.text();
      return NextResponse.json(
        { message: "OpenRouter request failed", status: resp.status, body },
        { status: 502 }
      );
    }

    const completion = (await resp.json()) as OpenRouterResponse;
    const result = (completion.choices?.[0]?.message?.content ?? "?").trim();
    const usage = completion.usage;

    console.log("[latex-solve]", { model: completion.model ?? model, latex, result, usage });

    return NextResponse.json({ result, usage, model: completion.model ?? model });
  } catch (err) {
    console.error("[latex-solve] error:", err);
    return NextResponse.json({ message: "Stage 2 failed" }, { status: 500 });
  }
}
