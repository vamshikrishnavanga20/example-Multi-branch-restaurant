import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const region = process.env.AWS_REGION || "ap-south-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const tableName = process.env.DYNAMODB_TABLE_NAME || "ManohaaHotel";
const bucketName = process.env.AWS_S3_BUCKET_NAME || "manohaa-hotel-assets";

console.log("\n========================================================");
console.log("   S4 MANOHAA FOOD PLAZA — AWS 1-CLICK INFRA SETUP");
console.log("========================================================\n");

if (!accessKeyId || accessKeyId === "YOUR_AWS_ACCESS_KEY_HERE" || !secretAccessKey || secretAccessKey === "YOUR_AWS_SECRET_KEY_HERE") {
  console.error("❌ Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local first!");
  process.exit(1);
}

const credentials = { accessKeyId, secretAccessKey };
const ddbRaw = new DynamoDBClient({ region, credentials });
const ddbDoc = DynamoDBDocumentClient.from(ddbRaw);
const s3 = new S3Client({ region, credentials });

// ---------------------------------------------------------------------------
// 1. Create DynamoDB Table (Pay-Per-Request / On-Demand = ₹0 Idle Cost)
// ---------------------------------------------------------------------------
async function setupDynamoDB() {
  console.log(`⏳ [1/3] Checking DynamoDB table "${tableName}"...`);
  try {
    await ddbRaw.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`   ✓ Table "${tableName}" already exists.`);
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log(`   ⚙️ Creating table "${tableName}" (On-Demand billing)...`);
      await ddbRaw.send(
        new CreateTableCommand({
          TableName: tableName,
          KeySchema: [
            { AttributeName: "PK", KeyType: "HASH" },
            { AttributeName: "SK", KeyType: "RANGE" },
          ],
          AttributeDefinitions: [
            { AttributeName: "PK", AttributeType: "S" },
            { AttributeName: "SK", AttributeType: "S" },
          ],
          BillingMode: "PAY_PER_REQUEST", // 100% free when not in use!
        })
      );
      console.log("   ⏳ Waiting for table to become ACTIVE...");
      await waitUntilTableExists({ client: ddbRaw, maxWaitTime: 60 }, { TableName: tableName });
      console.log(`   ✅ Table "${tableName}" successfully created and active!`);
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Create S3 Bucket & Configure CORS
// ---------------------------------------------------------------------------
async function setupS3() {
  console.log(`\n⏳ [2/3] Checking S3 Bucket "${bucketName}"...`);
  let bucketExists = false;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    bucketExists = true;
    console.log(`   ✓ Bucket "${bucketName}" already exists.`);
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      console.log(`   ⚙️ Creating S3 Bucket "${bucketName}" in region ${region}...`);
      const createParams = {
        Bucket: bucketName,
        ...(region !== "us-east-1"
          ? { CreateBucketConfiguration: { LocationConstraint: region } }
          : {}),
      };
      await s3.send(new CreateBucketCommand(createParams));
      console.log(`   ✅ S3 Bucket "${bucketName}" created!`);
    } else {
      console.warn(`   ⚠️ Bucket check notice: ${err.message}`);
    }
  }

  // Setup CORS so the browser can upload directly via pre-signed URLs
  try {
    console.log("   ⚙️ Configuring S3 CORS policy for browser uploads...");
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
              AllowedOrigins: ["http://localhost:3000", "https://*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      })
    );
    console.log("   ✅ S3 CORS policy configured successfully.");

    console.log("   ⚙️ Configuring S3 public read access for dish images...");
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
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify({
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
        }),
      })
    );
    console.log("   ✅ S3 public read policy configured successfully.");
  } catch (corsErr) {
    console.warn(`   ⚠️ Notice configuring S3 permissions: ${corsErr.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Seed Starter Hotel Categories & Sample Dishes (if empty)
// ---------------------------------------------------------------------------
async function seedInitialData() {
  console.log("\n⏳ [3/3] Seeding initial Categories & Menu items...");
  const starterCategories = [
    { id: "cat-south-indian", name: "South Indian Tiffins", sort_order: 1 },
    { id: "cat-biryani", name: "Royal Biryani & Rice", sort_order: 2 },
    { id: "cat-starters", name: "Tandoori & Starters", sort_order: 3 },
    { id: "cat-beverages", name: "Beverages & Desserts", sort_order: 4 },
  ];

  const starterDishes = [
    {
      id: "dish-ghee-karam-dosa",
      name: "Special Ghee Karam Dosa",
      desc: "Crispy golden dosa roasted in pure desi ghee, layered with spicy garlic chutney powder.",
      price: 95,
      category_id: "cat-south-indian",
      img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80",
      available: true,
      popular: true,
      is_veg: true,
      dietary_tags: ["Vegetarian", "Crispy", "Chef Special"],
    },
    {
      id: "dish-hyderabadi-biryani",
      name: "Special Dum Biryani",
      desc: "Aromatic basmati rice cooked on slow dum with royal spices and tender cuts.",
      price: 280,
      category_id: "cat-biryani",
      img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
      available: true,
      popular: true,
      is_veg: false,
      dietary_tags: ["Chef Special", "Spicy"],
    },
    {
      id: "dish-paneer-tikka",
      name: "Paneer Malai Tikka",
      desc: "Fresh cottage cheese marinated in cream, herbs and roasted in traditional tandoor.",
      price: 220,
      category_id: "cat-starters",
      img: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80",
      available: true,
      popular: true,
      is_veg: true,
      dietary_tags: ["Vegetarian", "Tandoori"],
    },
    {
      id: "dish-filter-coffee",
      name: "Authentic Degree Filter Coffee",
      desc: "Freshly brewed traditional chicory-infused south Indian filter kaapi in brass dabara.",
      price: 35,
      category_id: "cat-beverages",
      img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
      available: true,
      popular: true,
      is_veg: true,
      dietary_tags: ["Hot", "Traditional"],
    },
  ];

  const now = new Date().toISOString();

  for (const cat of starterCategories) {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: "CAT",
          SK: `CAT#${cat.id}`,
          id: cat.id,
          name: cat.name,
          sort_order: cat.sort_order,
          created_at: now,
        },
      })
    );
  }
  console.log(`   ✓ Seeded ${starterCategories.length} categories.`);

  for (const dish of starterDishes) {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: "MENU",
          SK: `DISH#${dish.id}`,
          ...dish,
          created_at: now,
        },
      })
    );
  }
  console.log(`   ✓ Seeded ${starterDishes.length} signature dishes.`);
  console.log("   ✅ Starter data ready!");
}

async function main() {
  try {
    await setupDynamoDB();
    await setupS3();
    await seedInitialData();
    console.log("\n========================================================");
    console.log("🎉 AWS INFRASTRUCTURE SETUP COMPLETED SUCCESSFULLY!");
    console.log("Next steps:");
    console.log("  1. Run 'node scripts/test-aws.mjs' to verify health.");
    console.log("  2. Run 'npm run dev' to launch S4 Manohaa Food Plaza!");
    console.log("========================================================\n");
  } catch (err) {
    console.error("\n❌ Setup failed:", err);
    process.exit(1);
  }
}

main();
