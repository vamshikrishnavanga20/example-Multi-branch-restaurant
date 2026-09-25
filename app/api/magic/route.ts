import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifySession } from '@/lib/aws/auth';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized access. Valid session required." }, { status: 401 });
    }

    const { dishName } = await req.json();

    if (!dishName) {
      return NextResponse.json({ error: "Dish name is required." }, { status: 400 });
    }
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.6-flash" 
    });
    
    const prompt = `You are an expert, high-end food copywriter. Write a mouth-watering, 2-sentence description for a restaurant dish named "${dishName}". Make it sound delicious, premium, and appetizing. Do not use quotes around the response.`;
    
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```/g, '').trim();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Magic AI Error:", error.message);
    return NextResponse.json(
      { text: "A delicious, premium offering crafted by our expert chefs." }, 
      { status: 500 }
    );
  }
}