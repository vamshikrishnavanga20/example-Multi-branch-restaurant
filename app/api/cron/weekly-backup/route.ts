import { NextResponse } from "next/server";
import { executeWeeklyBackup, listHistoricalBackups, getPreviousWeekRange } from "@/lib/aws/backup";
import { verifySession } from "@/lib/aws/auth";

export const maxDuration = 60;

async function isAuthorized(req: Request): Promise<boolean> {
  // 1. Cron Secret Authorization (Vercel Cron / EventBridge / AWS API Destination)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // 2. Super Admin Session Cookie Authorization
  try {
    const { authenticated, user } = await verifySession();
    if (authenticated && user && user.role === "super_admin") {
      return true;
    }
  } catch (_) {}

  return false;
}

export async function GET(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized. Provide valid Bearer token or sign in as Super Admin." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // List past archives in S3
    if (action === "list") {
      const archives = await listHistoricalBackups();
      const currentWeek = getPreviousWeekRange();
      return NextResponse.json({
        success: true,
        previous_week: currentWeek,
        archives_count: archives.length,
        archives,
      });
    }

    // Execute backup
    const week = searchParams.get("week") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const force = searchParams.get("force") === "true" || searchParams.get("force") === "1";

    const result = await executeWeeklyBackup({
      weekString: week,
      startDate,
      endDate,
      force,
      triggeredBy: "cron_api_route",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Weekly Backup API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute weekly backup.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
