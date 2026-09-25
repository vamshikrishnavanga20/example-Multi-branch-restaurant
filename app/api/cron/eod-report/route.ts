import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Orders, MenuItems } from '@/lib/aws/dynamodb';

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    // 1. Security: Ensure only your Cron service can trigger this
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Fetch Today's Data from DynamoDB
    const today = new Date();
    const dateKey = today.toISOString().split("T")[0]; // YYYY-MM-DD

    const ledgerEntries = await Orders.queryByDateRange(dateKey, dateKey);

    if (!ledgerEntries || ledgerEntries.length === 0) {
      return NextResponse.json({ message: "No sales today." });
    }

    // 3. Fetch all menu items for name resolution
    const allDishes = await MenuItems.listAll();
    const dishMap = new Map(allDishes.map(d => [d.id, d]));

    // 4. Aggregate Data
    let totalRevenue = 0;
    const itemCounts: Record<string, number> = {};
    
    ledgerEntries.forEach((entry) => {
      const dish = dishMap.get(entry.menu_item_id);
      const name = dish?.name || 'Unknown';
      const qty = Number(entry.quantity || 1);
      totalRevenue += Number(entry.total_price || 0);
      itemCounts[name] = (itemCounts[name] || 0) + qty;
    });

    const itemsListString = Object.entries(itemCounts)
      .map(([name, qty]) => `• ${name}: ${qty} plates`)
      .join('\n');

    // 5. Generate Simple AI Analysis
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash", generationConfig: { temperature: 0.2 } });
    
    const prompt = `
      You are a friendly assistant for the cafe manager.
      Today's Revenue: ₹${totalRevenue}
      Items Sold: ${JSON.stringify(itemCounts)}
      
      Write a VERY SIMPLE, short report. 
      Use basic English. No complex business words.
      Format exactly like this (do not use markdown blocks):

      *AI Summary:*
      [1 simple sentence about today's sales]

      *Top Idea to Grow:*
      [1 simple, easy-to-understand suggestion on what to do tomorrow to get more sales]
    `;

    const aiResult = await model.generateContent(prompt);
    const aiText = aiResult.response.text().trim();

    // 6. Construct Final WhatsApp Message
    const messageBody = `📊 *EXAMPLE PROJECT DAILY REPORT*\n\n💰 *Total Revenue:* ₹${totalRevenue}\n\n📋 *Items Sold:*\n${itemsListString}\n\n🤖 ${aiText}`;

    // 7. Dispatch via Meta WhatsApp Cloud API
    const waResponse = await fetch(`https://graph.facebook.com/v17.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: process.env.OWNER_WHATSAPP_NUMBER,
        type: "text",
        text: { body: messageBody }
      })
    });

    if (!waResponse.ok) throw new Error("WhatsApp dispatch failed");

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}