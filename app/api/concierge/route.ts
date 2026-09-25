import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { prompt, menuData } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ message: "Please provide a valid query.", filteredIds: [] }, { status: 400 });
    }

    // Clamp user prompt to 250 characters to prevent prompt injection and token exhaustion
    const safePrompt = prompt.trim().slice(0, 250);

    // Sanitize menuData input: keep only id, name, price, is_veg, dietary_tags
    const sanitizedMenu = Array.isArray(menuData)
      ? menuData.slice(0, 100).map((m: any) => ({
          id: m.id,
          name: m.name,
          price: m.price,
          is_veg: m.is_veg,
          dietary_tags: m.dietary_tags,
          category_id: m.category_id,
        }))
      : [];
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.6-flash", 
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const systemPrompt = `You are a smart AI dining assistant. The user says: "${safePrompt}"
    
    Here is the JSON data for our current menu:
    ${JSON.stringify(sanitizedMenu)}
    
    Analyze the menu and find all items that match the user's request (e.g., price limits, veg/non-veg, spicy, etc.).
    
    Respond using this exact JSON structure:
    {
      "message": "A friendly 1-sentence response confirming what you found.",
      "filteredIds": ["id-1", "id-2"]
    }`;
    
    const result = await model.generateContent(systemPrompt);
    let text = result.response.text();
    
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
    
    return NextResponse.json(JSON.parse(text));
    
  } catch (error: any) {
    console.error("AI Concierge Error:", error.message);
    
    return NextResponse.json(
      { 
        message: "Our AI dining concierge is temporarily busy. Please browse the menu sections directly.", 
        filteredIds: [] 
      }, 
      { status: 500 }
    );
  }
}