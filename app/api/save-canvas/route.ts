import { NextResponse } from "next/server";

interface SaveCanvasPayload {
    image?: string;
    text?: string;
    debug?: boolean;
}

type OpenRouterChatResponse = {
    id?: string;
    model?: string;
    choices?: Array<{
        message?: {
            content?: unknown;
        };
    }>;
};

function extractBase64FromDataUrl(dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const [, mimeType, base64] = match;
    return { mimeType, base64 };
}

function tryParseJson<T>(input: string): { ok: true; value: T } | { ok: false; error: string } {
    try {
        return { ok: true, value: JSON.parse(input) as T };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Failed to parse JSON" };
    }
}

function stripCodeFences(text: string) {
    return text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

export async function POST(req: Request) {
    try {
        const data = (await req.json()) as SaveCanvasPayload;
        const debug = Boolean(data.debug);

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { message: "Missing OPENROUTER_API_KEY" },
                { status: 500 }
            );
        }

        // 1) OCR (optional): if caller provides an image, turn it into text.
        // If caller already provides text, skip OCR.
        let extractedText = (data.text ?? "").trim();
        let ocrModelUsed: string | undefined;
        let ocrRaw: string | undefined;
        if (!extractedText && data.image) {
            const googleKey = process.env.GOOGLE_OCR_API_KEY ?? process.env.API_KEY;
            if (!googleKey) {
                return NextResponse.json(
                    { message: "Missing GOOGLE_OCR_API_KEY (or API_KEY) for Google OCR" },
                    { status: 500 }
                );
            }

            const extracted = extractBase64FromDataUrl(data.image);
            if (!extracted) {
                return NextResponse.json(
                    { message: "Invalid image data URL" },
                    { status: 400 }
                );
            }

            ocrModelUsed = "google-cloud-vision:text-detection";

            const ocrResp = await fetch(
                `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(googleKey)}`,
                {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requests: [
                        {
                            image: { content: extracted.base64 },
                            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                        },
                    ],
                }),
                }
            );

            if (!ocrResp.ok) {
                const text = await ocrResp.text();
                return NextResponse.json(
                    { message: "OCR request failed", status: ocrResp.status, body: text },
                    { status: 502 }
                );
            }

            const ocrJson = (await ocrResp.json()) as {
                responses?: Array<{
                    fullTextAnnotation?: { text?: string };
                    textAnnotations?: Array<{ description?: string }>;
                    error?: { message?: string };
                }>;
            };

            const first = ocrJson.responses?.[0];
            const googleError = first?.error?.message;
            if (googleError) {
                return NextResponse.json(
                    { message: "Google OCR error", body: googleError },
                    { status: 502 }
                );
            }

            extractedText =
                String(first?.fullTextAnnotation?.text ?? first?.textAnnotations?.[0]?.description ?? "").trim();
            ocrRaw = extractedText;

            console.log("[save-canvas][ocr]", {
                model: ocrModelUsed,
                extractedText,
            });
        }

        if (!extractedText) {
            return NextResponse.json(
                { message: "No input text found (send {text} or {image})." },
                { status: 400 }
            );
        }

        // 2) Solve: use a text model and return strict JSON.
        const solveModel = process.env.OPENROUTER_SOLVE_MODEL ?? "openrouter/free";
        const solveModelRequested = solveModel;
        const solvePrompt =
            `You will receive OCR-extracted math text.\n` +
            `Return ONLY valid JSON: an array of objects, each with keys "expr" and "result".\n` +
            `Example: [{"expr":"2+2","result":"4"}]\n` +
            `Rules: no markdown, no backticks, no extra text.\n` +
            `OCR text:\n${extractedText}`;

        const solveResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: solveModel,
                temperature: 0,
                messages: [{ role: "user", content: solvePrompt }],
            }),
        });

        if (!solveResp.ok) {
            const text = await solveResp.text();
            return NextResponse.json(
                { message: "Solve request failed", status: solveResp.status, body: text, extractedText },
                { status: 502 }
            );
        }

        const completion = (await solveResp.json()) as OpenRouterChatResponse;
        const solveRaw = String(completion?.choices?.[0]?.message?.content ?? "");
        const content = solveRaw.trim();

        console.log("[save-canvas][solve]", {
            model: completion?.model ?? solveModelRequested,
            extractedText,
            raw: solveRaw,
        });

        const parsed = tryParseJson<unknown>(stripCodeFences(content));
        if (!parsed.ok) {
            return NextResponse.json(
                {
                    message: "Solve model returned non-JSON output",
                    extractedText,
                    raw: content,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            message: "Canvas data success",
            extractedText,
            result: parsed.value,
            model: completion?.model,
            ...(debug
                ? {
                    debug: {
                        ocrModel: ocrModelUsed,
                        ocrRaw,
                        solveModel: completion?.model ?? solveModelRequested,
                        solveRaw,
                    },
                }
                : {}),
        });
    }
    catch (err) {
        console.log("Error having response", err);
        return NextResponse.json(
            { message: "Error saving canvas data" },
            { status: 500 }
        );
    }
}
