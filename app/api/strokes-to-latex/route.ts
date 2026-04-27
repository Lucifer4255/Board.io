import { NextResponse } from "next/server";

export const maxDuration = 30;

interface ImageToLatexPayload {
  image: string; // data URL: "data:image/jpeg;base64,..."
  previousExpression?: string | null;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export async function POST(req: Request) {
  try {
    const { image, previousExpression } = (await req.json()) as ImageToLatexPayload;

    if (!image) {
      return NextResponse.json({ message: "No image provided." }, { status: 400 });
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "Missing API_KEY (Google Gemini)" }, { status: 500 });
    }

    // Strip the data URL prefix to get raw base64
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ message: "Invalid image data URL." }, { status: 400 });
    }
    const [, mimeType, base64Data] = match;

    const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: { mime_type: mimeType, data: base64Data },
                },
                {
                  text:
                    "This image contains a handwritten mathematical expression on a dark background.\n" +
                    (previousExpression
                      ? `Context: the canvas previously showed "${previousExpression}" (already solved). The user has written something NEW on top or nearby — focus only on the new handwriting.\n`
                      : "") +
                    "Recognize what is written and output it as a LaTeX string.\n" +
                    "Rules:\n" +
                    "- Output ONLY the raw LaTeX. No explanation, no markdown, no $...$ wrappers.\n" +
                    "- Include all operators, equals signs, and symbols exactly as written.\n" +
                    "- If unrecognizable, output: ?\n" +
                    "Example output: \\frac{d}{dx}x^2 + 3x - 1",
                },
              ],
            },
          ],
        }),
      }
    );

    clearTimeout(timeout);

    if (!resp.ok) {
      const body = await resp.text();
      return NextResponse.json(
        { message: "Gemini request failed", status: resp.status, body },
        { status: 502 }
      );
    }

    const data = (await resp.json()) as GeminiResponse;
    const latex = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "?").trim();
    const usage = data.usageMetadata;

    console.log("[image-to-latex]", { model, latex, usage });

    return NextResponse.json({ latex, usage, model });
  } catch (err) {
    console.error("[image-to-latex] error:", err);
    return NextResponse.json({ message: "Stage 1 failed" }, { status: 500 });
  }
}
