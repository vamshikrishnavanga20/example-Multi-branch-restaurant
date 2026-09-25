import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const region = process.env.AWS_REGION || "ap-south-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const tableName = process.env.DYNAMODB_TABLE_NAME || "ManohaaHotel";
const bucketName = process.env.AWS_S3_BUCKET_NAME || "manohaa-hotel-assets";

console.log("\n========================================================");
console.log("   S4 MANOHAA FOOD PLAZA — AWS CONNECTION TEST");
console.log("========================================================\n");

console.log(`Region:         ${region}`);
console.log(`DynamoDB Table: ${tableName}`);
console.log(`S3 Bucket:      ${bucketName}`);
console.log(`Access Key ID:  ${accessKeyId ? accessKeyId.slice(0, 4) + "..." + accessKeyId.slice(-4) : "NOT SET"}`);
console.log("--------------------------------------------------------\n");

let hasErrors = false;

// 1. Check Environment Variables
if (!accessKeyId || accessKeyId === "YOUR_AWS_ACCESS_KEY_HERE") {
  console.error("❌ AWS_ACCESS_KEY_ID is missing or set to placeholder in .env.local");
  hasErrors = true;
}
if (!secretAccessKey || secretAccessKey === "YOUR_AWS_SECRET_KEY_HERE") {
  console.error("❌ AWS_SECRET_ACCESS_KEY is missing or set to placeholder in .env.local");
  hasErrors = true;
}

if (hasErrors) {
  console.log("\n👉 Please edit .env.local with your real AWS credentials and run this test again.\n");
  process.exit(1);
}

const credentials = { accessKeyId, secretAccessKey };

// 2. Test DynamoDB
async function testDynamoDB() {
  console.log("⏳ [1/2] Testing AWS DynamoDB connection...");
  const rawClient = new DynamoDBClient({ region, credentials });
  const docClient = DynamoDBDocumentClient.from(rawClient);

  try {
    // Check if table exists
    const describeRes = await rawClient.send(new DescribeTableCommand({ TableName: tableName }));
    const status = describeRes.Table?.TableStatus;
    console.log(`   ✓ Table "${tableName}" found. Status: ${status}`);

    // Test Write
    const testKey = { PK: "TEST#PING", SK: "TEST#PING" };
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        ...testKey,
        message: "AWS connection test successful",
        timestamp: new Date().toISOString(),
      },
    }));
    console.log("   ✓ Write test: Successfully inserted test item");

    // Test Read
    const getRes = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: testKey,
    }));
    if (getRes.Item?.message === "AWS connection test successful") {
      console.log("   ✓ Read test: Successfully retrieved test item");
    }

    // Cleanup
    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: testKey,
    }));
    console.log("   ✓ Cleanup: Successfully deleted test item");

    console.log("✅ DynamoDB Connection: HEALTHY & FULLY WORKING\n");
    return true;
  } catch (err) {
    console.error(`❌ DynamoDB Error: ${err.message}`);
    if (err.name === "ResourceNotFoundException") {
      console.log(`   👉 The table "${tableName}" does not exist yet.`);
      console.log(`   👉 You can run: node scripts/setup-aws.mjs to create it automatically!\n`);
    }
    return false;
  }
}

// 3. Test S3
async function testS3() {
  console.log("⏳ [2/2] Testing AWS S3 connection...");
  const s3 = new S3Client({ region, credentials });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`   ✓ Bucket "${bucketName}" exists and is accessible`);

    // Test write small file
    const testKey = "test-ping.txt";
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: "AWS S3 connection test",
      ContentType: "text/plain",
    }));
    console.log("   ✓ Write test: Uploaded test object to S3");

    // Clean up
    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }));
    console.log("   ✓ Cleanup: Deleted test object from S3");

    console.log("✅ S3 Storage Connection: HEALTHY & FULLY WORKING\n");
    return true;
  } catch (err) {
    console.error(`❌ S3 Error: ${err.message}`);
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`   👉 The S3 bucket "${bucketName}" does not exist.`);
      console.log(`   👉 You can run: node scripts/setup-aws.mjs to create it automatically!\n`);
    }
    return false;
  }
}

async function run() {
  const ddbOk = await testDynamoDB();
  const s3Ok = await testS3();

  console.log("========================================================");
  if (ddbOk && s3Ok) {
    console.log("🎉 ALL AWS SERVICES ARE CONNECTED AND OPERATIONAL!");
    console.log("You are ready to run: npm run dev");
  } else {
    console.log("⚠️ Some services need setup. Review the instructions above.");
  }
  console.log("========================================================\n");
}

run();
