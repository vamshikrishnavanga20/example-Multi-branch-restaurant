import {
  S3Client,
  PutPublicAccessBlockCommand,
  PutBucketPolicyCommand,
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
const bucketName = process.env.AWS_S3_BUCKET_NAME || "manohaa-hotel-assets";

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

async function makeBucketPublicReadable() {
  console.log(`Configuring public read access for S3 bucket "${bucketName}"...`);

  // 1. Disable Block Public Access for policies
  console.log("1. Updating PublicAccessBlock configuration...");
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    })
  );
  console.log("   ✓ BlockPublicPolicy and RestrictPublicBuckets turned off.");

  // 2. Attach public GetObject bucket policy
  console.log("2. Applying public read bucket policy...");
  const bucketPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadForDishesAndAssets",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
    ],
  };

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    })
  );
  console.log("   ✓ Public read policy applied successfully!");
}

makeBucketPublicReadable().catch((err) => {
  console.error("Failed:", err.name, err.message);
  process.exit(1);
});
