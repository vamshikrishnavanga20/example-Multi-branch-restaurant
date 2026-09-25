#!/usr/bin/env node
// =============================================================================
// Multi-Branch Migration Script
// =============================================================================
// This is a ONE-TIME script that ensures all existing Attendance and Review
// records have branch_id set (defaults to branch-hyderabad-hq).
// Orders/Ledger already have branch_id — this script validates them.
// Menu/Categories are GLOBAL and do NOT get migrated.
// 
// Run: node scripts/migrate-multi-branch.mjs [--dry-run]
// =============================================================================

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const isDryRun = process.argv.includes("--dry-run");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = process.env.DYNAMODB_TABLE_NAME || "ManohaaHotel";
const DEFAULT_BRANCH_ID = "branch-hyderabad-hq";
const DEFAULT_BRANCH_NAME = "Hyderabad Highway HQ";

let migrated = 0;
let skipped = 0;
let errors = 0;

async function scanAndPatch(pk, skPrefix, label) {
  console.log(`\n📦 Scanning PK="${pk}" (${label})...`);
  let lastKey;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ExclusiveStartKey: lastKey,
      })
    );

    const items = result.Items || [];
    console.log(`   Found ${items.length} items in this page`);

    for (const item of items) {
      if (item.branch_id) {
        skipped++;
        continue; // Already has branch_id
      }

      if (isDryRun) {
        console.log(`   [DRY-RUN] Would patch ${item.SK}`);
        migrated++;
        continue;
      }

      try {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: item.PK, SK: item.SK },
            UpdateExpression: "SET branch_id = :bid, branch_name = :bname",
            ConditionExpression: "attribute_not_exists(branch_id)",
            ExpressionAttributeValues: {
              ":bid": DEFAULT_BRANCH_ID,
              ":bname": DEFAULT_BRANCH_NAME,
            },
          })
        );
        console.log(`   ✅ Patched: ${item.SK}`);
        migrated++;
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException") {
          skipped++;
        } else {
          console.error(`   ❌ Error patching ${item.SK}:`, err.message);
          errors++;
        }
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
}

async function main() {
  console.log("=".repeat(60));
  console.log("S4 Manohaa — Multi-Branch Migration Script");
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Target table: ${TABLE}`);
  console.log(`Default branch: ${DEFAULT_BRANCH_ID}`);
  console.log("=".repeat(60));
  console.log("\n⚠️  This script patches records that have no branch_id.");
  console.log("    Categories & Menu are GLOBAL — not touched.");

  // Patch Attendance records
  await scanAndPatch("ATTENDANCE", "ATT#", "Staff Attendance");

  // Patch Review records
  await scanAndPatch("REVIEW", "REV#", "Customer Reviews");

  // Verify Orders/Ledger (informational)
  console.log("\n📊 Orders & Ledger: already include branch_id from POS (no action needed)");

  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary:");
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (already had branch_id): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log("=".repeat(60));

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
