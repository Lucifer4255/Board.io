import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
// import { env } from "process";

interface imgData {
    image: string;
}

function jsonToGenerative(imageJson: imgData) {
    // const {data,mimeType} = imageJson;
    const { image } = imageJson;
    const [mimeType, data] =
        image.match(/^data:([^;]+);base64,(.+)$/)?.slice(1) || []; // Extracting mimetype and base64 data from image string.  // The regular expression /^data:([^;]+);base64,(.+)$/ matches the data string and extracts the mimetype and base64 data. If it doesn't match, it returns null. Then it slices the array to get the
    return {
        inlineData: {
            data,
            mimeType,
        },
    };
}
export async function POST(req: Request) {
    try {
        const data = await req.json();
        // console.log(data);
        const API_KEY = process.env.API_KEY!;
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const img = jsonToGenerative(data);
        const prompt =
            `"Analyze the image and provide a JSON response following these rules:

Simple Math:
[{ "expr": "expression", "result": "answer" }]
Use code with caution.

Equations:
[{ "expr": "variable", "result": "value", "assign": true }]
Use code with caution.

Variable Assignment:
[{ "expr": "variable", "result": "value", "assign": true }]
Use code with caution.

Graphical Math:
[{ "expr": "problem description", "result": "solution" }]
Use code with caution.

Abstract Concepts:
[{ "expr": "image interpretation", "result": "concept" }]
Use code with caution.

Give the JSON representation in exact format as mentioned
Remember to use BODMAS for calculations."`

        const result = await model.generateContent([prompt, img]);
        // console.log(result);
        const res = result.response.text();
        console.log(res);
        return NextResponse.json({ message: "Canva data success", result: res });
    }
    catch (err) {
        console.log("Error having reponse", err);
        return NextResponse.json(
            { message: "Error saving canvas data" },
            { status: 500 }
        );
    }
}
