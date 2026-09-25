import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/aws/auth';
import { Branches } from '@/lib/aws/dynamodb';

export async function POST(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized access. Valid session required." }, { status: 401 });
    }

    if (!process.env.WA_PHONE_NUMBER_ID || !process.env.WA_ACCESS_TOKEN) {
      return NextResponse.json({ error: "WhatsApp service not configured." }, { status: 503 });
    }

    const { 
      orderId, 
      items, 
      orderType, 
      branch_id, 
      table_number, 
      round_number, 
      order_notes 
    } = await req.json();

    if (!orderId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid order data." }, { status: 400 });
    }

    // Lookup branch specific chef WhatsApp contact
    let recipientNumber = process.env.CHEF_WHATSAPP_NUMBER;
    let branchName = "Hyderabad Highway HQ";

    if (branch_id) {
      try {
        const branch = await Branches.get(branch_id);
        if (branch) {
          branchName = branch.name || branchName;
          if (branch.chef_whatsapp_number?.trim()) {
            recipientNumber = branch.chef_whatsapp_number.trim();
          }
        }
      } catch (branchErr) {
        console.warn("Branch lookup warning for chef WhatsApp:", branchErr);
      }
    }

    if (!recipientNumber) {
      return NextResponse.json({ error: "No chef WhatsApp number configured for this branch." }, { status: 503 });
    }

    // Format the Kitchen Ticket (KOT)
    let messageBody = `👨‍🍳 *KITCHEN ORDER TICKET (KOT)*\n`;
    messageBody += `🏢 *Outlet:* ${branchName}\n`;
    messageBody += `🪑 *Table:* ${table_number || 'Counter / Walk-in'}\n`;
    if (round_number) {
      messageBody += `🔄 *Round:* Round ${round_number}\n`;
    }
    messageBody += `🛎️ *Type:* ${(orderType || 'Dine-In').toUpperCase()}\n`;
    messageBody += `🔖 *Ticket ID:* #${orderId.slice(-6).toUpperCase()}\n`;
    messageBody += `⏰ *Time:* ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit' })}\n\n`;
    
    messageBody += `*ITEMS TO PREPARE:*\n`;
    items.forEach((item: any) => {
      messageBody += `👉 *${item.quantity || 1}x* ${item.name || 'Item'}\n`;
      if (item.notes) messageBody += `   _(Prep Note: ${item.notes})_\n`;
    });

    if (order_notes?.trim()) {
      messageBody += `\n⚠️ *KITCHEN INSTRUCTION:*\n"${order_notes.trim()}"\n`;
    }

    // Clean recipient phone number (remove spaces, hyphens, ensure country code)
    const cleanTo = recipientNumber.replace(/[^0-9]/g, '');

    // Dispatch via Meta WhatsApp Cloud API
    const waResponse = await fetch(`https://graph.facebook.com/v17.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanTo, 
        type: "text",
        text: { body: messageBody }
      })
    });

    if (!waResponse.ok) {
      const waError = await waResponse.text();
      console.error("Meta WhatsApp API error:", waError);
      throw new Error("Kitchen dispatch failed");
    }

    return NextResponse.json({ success: true, branch: branchName, recipient: cleanTo });

  } catch (err: any) {
    console.error("WhatsApp Route Error:", err);
    return NextResponse.json({ error: err.message || "Failed to dispatch ticket." }, { status: 500 });
  }
}