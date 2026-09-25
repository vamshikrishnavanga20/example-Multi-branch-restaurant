import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/aws/auth';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

export async function POST(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized access. Valid session required." }, { status: 401 });
    }

    const { prompt, ledgerData } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const systemInstruction = `
      You are Sommelier, an expert AI restaurant analyst for 'Example Project'.
      Here is the operational sales data: ${JSON.stringify(ledgerData || [])}.
      Analyze this data carefully. Calculate totals if necessary. 
      Format your response beautifully using markdown, bullet points, and bold text.
      Answer the query: ${prompt}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: systemInstruction,
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("CRITICAL AI ROUTE ERROR:", error);
    return NextResponse.json({ 
      text: "AI service temporarily unavailable." 
    }, { status: 500 });
  }
}