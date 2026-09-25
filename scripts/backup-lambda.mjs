// =============================================================================
// S4 MANOHAA FOOD PLAZA — STANDALONE AWS LAMBDA BACKUP HANDLER
// =============================================================================
// Can be deployed directly to AWS Lambda and triggered via AWS EventBridge Rule:
//   Schedule: cron(0 2 ? * MON *)  [Runs every Monday at 02:00 UTC]
// =============================================================================

import { executeWeeklyBackup } from "../lib/aws/backup.js";

/**
 * AWS Lambda Handler for EventBridge Trigger
 */
export const handler = async (event, context) => {
  console.log("[AWS Lambda Backup Handler] EventBridge trigger received:", JSON.stringify(event));

  try {
    const force = Boolean(event?.force || event?.queryStringParameters?.force === "true");
    const weekString = event?.weekString || event?.queryStringParameters?.week;
    const startDate = event?.startDate || event?.queryStringParameters?.startDate;
    const endDate = event?.endDate || event?.queryStringParameters?.endDate;

    const result = await executeWeeklyBackup({
      weekString,
      startDate,
      endDate,
      force,
      triggeredBy: "aws_eventbridge_lambda",
    });

    console.log("[AWS Lambda Backup Handler] Execution succeeded:", JSON.stringify(result));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("[AWS Lambda Backup Handler] Execution failed:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: error.message || "Lambda backup execution failed",
      }),
    };
  }
};
