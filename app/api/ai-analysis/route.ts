import { NextResponse } from "next/server";
import { verifySession } from "@/lib/aws/auth";
import { Orders, MenuItems } from "@/lib/aws/dynamodb";
import Groq from "groq-sdk";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // 1. Verify admin session
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json(
        { reply: "Unauthorized access. Please log in to view business intelligence.", type: "text", grounded: false },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.userPrompt === "string" ? body.userPrompt.trim() : "";
    const timeframe = body?.timeframe || "today";

    if (!prompt) {
      return NextResponse.json({ error: "Valid prompt required." }, { status: 400 });
    }

    // 2. Fetch live DynamoDB data (Menu items and sales ledger)
    const [dishes, ledger] = await Promise.all([
      MenuItems.listAll().catch(() => []),
      Orders.listRecentLedger(3000).catch(() => []),
    ]);

    // 3. Compute telemetry summary
    const dishMap = new Map<string, { name: string; price: number }>();
    dishes.forEach((d) => dishMap.set(d.id, { name: d.name, price: d.price }));

    let totalRevenue = 0;
    let totalUnits = 0;
    const dishSales: Record<string, { name: string; units: number; revenue: number }> = {};

    ledger.forEach((entry: any) => {
      const dishInfo = dishMap.get(entry.menu_item_id);
      const name = dishInfo?.name || "Special Item";
      const units = Number(entry.quantity) || 1;
      const rev = Number(entry.total_price) || 0;

      totalRevenue += rev;
      totalUnits += units;

      if (!dishSales[name]) {
        dishSales[name] = { name, units: 0, revenue: 0 };
      }
      dishSales[name].units += units;
      dishSales[name].revenue += rev;
    });

    const sortedDishes = Object.values(dishSales).sort((a, b) => b.revenue - a.revenue);
    const topDish = sortedDishes[0]?.name || "N/A";

    const summary = {
      totalDishes: dishes.length,
      totalUnits,
      totalRevenue,
      topDish,
    };

    // 4. Generate AI analysis via Groq or Gemini
    let reply = "";
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const systemPrompt = `You are the executive AI Operations Analyst for Example Project.
Analyze the restaurant's operational telemetry accurately using the verified DynamoDB sales data provided below.
Current Business Summary:
- Total Sales Revenue: ₹${totalRevenue.toLocaleString("en-IN")}
- Total Items Sold: ${totalUnits}
- Top Revenue Generating Dish: ${topDish}
- Active Dishes in Menu: ${dishes.length}

Top 10 Dishes by Performance:
${sortedDishes.slice(0, 10).map((d, i) => `${i + 1}. ${d.name}: ${d.units} sold, ₹${d.revenue.toLocaleString("en-IN")}`).join("\n")}

Respond concisely and professionally with key insights, margins, culinary popularity, and actionable advice for the restaurant manager. Use bullet points and rupee signs (₹). Never invent fake numbers.`;

        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 800,
        });

        reply = completion.choices[0]?.message?.content || "Analysis complete.";
      } catch (aiErr: any) {
        console.warn("Groq inference error, falling back to data summary:", aiErr.message);
        reply = `**Business Summary:**\n- Total Revenue: ₹${totalRevenue.toLocaleString("en-IN")}\n- Items Sold: ${totalUnits}\n- Top Dish: ${topDish}\n\n${prompt}`;
      }
    } else {
      reply = `**Live Telemetry Report:**\n- Total Revenue: ₹${totalRevenue.toLocaleString("en-IN")}\n- Total Units Sold: ${totalUnits}\n- Best Performing Dish: ${topDish}`;
    }

    return NextResponse.json({
      reply,
      type: "text",
      grounded: true,
      data: {
        title: "Database Analysis",
        subtitle: `Timeframe: ${timeframe}`,
        answer: reply,
        sourceNote: "Computed directly from live DynamoDB transaction ledger.",
      },
      summary,
      timeframe: {
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        label: timeframe,
      },
    });
  } catch (error: any) {
    console.error("AI Analysis Route Error:", error);
    return NextResponse.json(
      { reply: "Error processing business intelligence telemetry.", type: "text", grounded: false },
      { status: 500 }
    );
  }
}