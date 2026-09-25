// =============================================================================
// S4 MANOHAA FOOD PLAZA — AWS BACKUP INFRASTRUCTURE PROVISIONING SCRIPT
// =============================================================================
// Idempotently provisions the dedicated, private S3 Backup Bucket with:
//   1. 100% Block Public Access
//   2. AES256 Default Server-Side Encryption
//   3. S3 Bucket Versioning (protection against tampering or accidental deletion)
//   4. S3 Lifecycle Rules (Archive to Glacier after 90 days for low-cost retention)
//   5. Least-Privilege IAM Policy generator for Lambda & EventBridge
// =============================================================================

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutPublicAccessBlockCommand,
  PutBucketEncryptionCommand,
  PutBucketVersioningCommand,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const region = process.env.AWS_REGION || "ap-south-2";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const backupBucketName = process.env.BACKUP_S3_BUCKET_NAME || "manohaa-hotel-backups";
const ddbTable = process.env.DYNAMODB_TABLE_NAME || "ManohaaHotel";

console.log("\n=================================================================");
console.log("   S4 MANOHAA — DEDICATED S3 BACKUP INFRASTRUCTURE SETUP");
console.log("=================================================================\n");

if (!accessKeyId || !secretAccessKey) {
  console.error("❌ Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env.local!");
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

async function setupBackupBucket() {
  console.log(`⏳ [1/5] Checking S3 Backup Bucket "${backupBucketName}" in ${region}...`);

  let exists = false;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: backupBucketName }));
    exists = true;
    console.log(`   ✓ Bucket "${backupBucketName}" already exists.`);
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`   ⚙️ Creating private S3 bucket "${backupBucketName}"...`);
      const createParams = {
        Bucket: backupBucketName,
        ...(region !== "us-east-1"
          ? { CreateBucketConfiguration: { LocationConstraint: region } }
          : {}),
      };
      await s3.send(new CreateBucketCommand(createParams));
      console.log(`   ✅ S3 Backup Bucket created!`);
    } else {
      console.warn(`   ⚠️ HeadBucket check notice: ${err.message}`);
    }
  }

  // 2. Enforce 100% Block Public Access
  console.log(`\n⏳ [2/5] Enforcing Block Public Access on "${backupBucketName}"...`);
  try {
    await s3.send(
      new PutPublicAccessBlockCommand({
        Bucket: backupBucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      })
    );
    console.log(`   ✅ Block Public Access enabled (All 4 settings ON - 100% Private).`);
  } catch (err) {
    console.error(`   ❌ Failed to set Block Public Access:`, err.message);
  }

  // 3. Enable Server-Side Encryption (AES256)
  console.log(`\n⏳ [3/5] Enforcing Server-Side Encryption (AES256)...`);
  try {
    await s3.send(
      new PutBucketEncryptionCommand({
        Bucket: backupBucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256",
              },
            },
          ],
        },
      })
    );
    console.log(`   ✅ Default Server-Side Encryption configured.`);
  } catch (err) {
    console.error(`   ❌ Failed to set encryption:`, err.message);
  }

  // 4. Enable Bucket Versioning
  console.log(`\n⏳ [4/5] Enabling Bucket Versioning for archival safety...`);
  try {
    await s3.send(
      new PutBucketVersioningCommand({
        Bucket: backupBucketName,
        VersioningConfiguration: {
          Status: "Enabled",
        },
      })
    );
    console.log(`   ✅ Bucket Versioning enabled.`);
  } catch (err) {
    console.error(`   ❌ Failed to enable versioning:`, err.message);
  }

  // 5. Configure Lifecycle Rules (Transition to Glacier after 90 days)
  console.log(`\n⏳ [5/5] Configuring Glacier Archival Lifecycle Rule...`);
  try {
    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: backupBucketName,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "ArchiveToGlacierAfter90Days",
              Status: "Enabled",
              Filter: { Prefix: "" },
              Transitions: [
                {
                  Days: 90,
                  StorageClass: "GLACIER",
                },
              ],
              NoncurrentVersionExpiration: {
                NoncurrentDays: 365,
              },
            },
          ],
        },
      })
    );
    console.log(`   ✅ Lifecycle rule configured: Transitions to Glacier after 90 days (ultra-low storage cost).`);
  } catch (err) {
    console.error(`   ❌ Failed to set lifecycle rules:`, err.message);
  }

  // Print IAM Policy Summary
  console.log("\n=================================================================");
  console.log("   AWS LEAST-PRIVILEGE IAM POLICY FOR BACKUP WORKER / LAMBDA");
  console.log("=================================================================");
  const iamPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "DynamoDBReadPreviousWeekOnly",
        Effect: "Allow",
        Action: ["dynamodb:Query", "dynamodb:GetItem"],
        Resource: [
          `arn:aws:dynamodb:${region}:*:table/${ddbTable}`,
          `arn:aws:dynamodb:${region}:*:table/${ddbTable}/index/*`,
        ],
      },
      {
        Sid: "S3WriteWeeklyArchiveOnly",
        Effect: "Allow",
        Action: ["s3:PutObject", "s3:HeadObject", "s3:GetObject"],
        Resource: `arn:aws:s3:::${backupBucketName}/*`,
      },
      {
        Sid: "S3ListBackupBucket",
        Effect: "Allow",
        Action: "s3:ListBucket",
        Resource: `arn:aws:s3:::${backupBucketName}`,
      },
      {
        Sid: "CloudWatchLogging",
        Effect: "Allow",
        Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Resource: `arn:aws:logs:${region}:*:log-group:/aws/lambda/*`,
      },
    ],
  };

  console.log(JSON.stringify(iamPolicy, null, 2));

  console.log("\n=================================================================");
  console.log("   AWS EVENTBRIDGE CRON EXPRESSION");
  console.log("=================================================================");
  console.log("   Rule Schedule : cron(0 2 ? * MON *)  [Every Monday at 02:00 AM UTC]");
  console.log("   Target        : AWS Lambda (scripts/backup-lambda.mjs)");
  console.log("   or HTTP Target: POST /api/cron/weekly-backup");
  console.log("=================================================================\n");
}

setupBackupBucket().catch((err) => {
  console.error("Infrastructure setup error:", err);
  process.exit(1);
});
