import { NextResponse } from "next/server";
import { WorkingDays, RealtimeEvents } from "@/lib/aws/dynamodb";
import { verifySession } from "@/lib/aws/auth";

// GET: Fetch calendar configuration (holidays & working days)
export async function GET(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month"); // e.g. "2026-09"

    const days = await WorkingDays.list(month || undefined);
    return NextResponse.json(days);
  } catch (error: any) {
    console.error("Calendar GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch calendar configuration." }, { status: 500 });
  }
}

// POST: Super Admin sets a day as working or non-working/holiday
export async function POST(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (user?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can configure hotel working days and holidays." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const adminName = (typeof user?.name === "string" ? user.name : undefined) || (typeof user?.email === "string" ? user.email : undefined) || "Super Admin";

    // Batch update support: { dates: string[], is_working_day: boolean, reason?: string }
    if (Array.isArray(body.dates) && body.dates.length > 0) {
      const items = body.dates.map((d: string) => ({
        date: d,
        isWorkingDay: Boolean(body.is_working_day),
        reason: body.reason || "",
        updatedBy: adminName,
      }));
      const updatedDays = typeof WorkingDays.setDaysBatch === "function"
        ? await WorkingDays.setDaysBatch(items)
        : await Promise.all(items.map((i: any) => WorkingDays.setDay(i.date, i.isWorkingDay, i.reason, i.updatedBy)));

      RealtimeEvents.emit({
        type: "CALENDAR_BATCH_UPDATED",
        data: updatedDays,
      });
      return NextResponse.json(updatedDays, { status: 200 });
    }

    const { date, is_working_day, reason } = body;

    if (!date) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) or dates array is required." }, { status: 400 });
    }

    const updatedDay = await WorkingDays.setDay(
      date,
      Boolean(is_working_day),
      reason || "",
      adminName
    );

    RealtimeEvents.emit({
      type: "CALENDAR_DAY_UPDATED",
      data: updatedDay,
    });

    return NextResponse.json(updatedDay, { status: 200 });
  } catch (error: any) {
    console.error("Calendar POST Error:", error);
    return NextResponse.json({ error: "Failed to configure calendar day." }, { status: 500 });
  }
}

// DELETE: Reset day override
export async function DELETE(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (user?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can modify calendar configuration." },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const date = url.searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date parameter is required." }, { status: 400 });
    }

    await WorkingDays.removeDayOverride(date);

    RealtimeEvents.emit({
      type: "CALENDAR_DAY_RESET",
      data: { date },
    });

    return NextResponse.json({ success: true, date });
  } catch (error: any) {
    console.error("Calendar DELETE Error:", error);
    return NextResponse.json({ error: "Failed to reset calendar day." }, { status: 500 });
  }
}
