import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { verifySession } from '@/lib/aws/auth';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { authenticated } = await verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized access. Valid session required." }, { status: 401 });
  }

  const { messages, data } = await req.json();

  const systemPrompt = `
    You are an expert AI data analyst for Example Project. 
    You are looking at the current live database metrics:
    ${JSON.stringify(data)}

    Your job is to answer the admin's questions about this data, spot trends, and offer actionable business advice.
    Keep your answers highly professional, concise, and heavily grounded in the numbers provided. Do not invent data.
  `;

  const result = await streamText({
    model: google('gemini-3.6-flash'),
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}