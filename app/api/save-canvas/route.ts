import { NextResponse } from "next/server";

interface SaveCanvasPayload {
    image?: string;
    text?: string;
}

type OpenAIContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

type OpenRouterChatResponse = {
    id?: string;
    model?: string;
    choices?: Array<{
        message?: {
            content?: unknown;
        };
    }>;
};

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
        if (!extractedText && data.image) {
            const ocrModel = process.env.OPENROUTER_OCR_MODEL ?? "qwen/qwen2.5-vl-3b-instruct:free";
            const ocrReq = {
                model: ocrModel,
                temperature: 0,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are an OCR engine for handwritten math. Extract the visible text faithfully. " +
                            "Return ONLY the extracted text, with no markdown, no code fences, no explanation.",
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Extract all handwritten math/text from this image." },
                            { type: "image_url", image_url: { url: data.image, detail: "low" } },
                        ] as OpenAIContentPart[],
                    },
                ],
            };

            const ocrResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(ocrReq),
            });

            if (!ocrResp.ok) {
                const text = await ocrResp.text();
                return NextResponse.json(
                    { message: "OCR request failed", status: ocrResp.status, body: text },
                    { status: 502 }
                );
            }

            const ocrJson = (await ocrResp.json()) as OpenRouterChatResponse;
            extractedText = String(ocrJson?.choices?.[0]?.message?.content ?? "").trim();
        }

        if (!extractedText) {
            return NextResponse.json(
                { message: "No input text found (send {text} or {image})." },
                { status: 400 }
            );
        }

        // 2) Solve: use a text model and return strict JSON.
        const solveModel = process.env.OPENROUTER_SOLVE_MODEL ?? "openrouter/free";
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
        const content = String(completion?.choices?.[0]?.message?.content ?? "").trim();
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
