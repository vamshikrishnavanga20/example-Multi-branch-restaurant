import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE = process.env.DYNAMODB_TABLE_NAME || "ManohaaHotel";

async function main() {
  console.log("Setting Hyderabad Highway HQ royalty_pct to 0 in DynamoDB...");

  const updateRes = await docClient.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: "BRANCH", SK: "BRANCH#branch-hyderabad-hq" },
      UpdateExpression: "SET royalty_pct = :r",
      ExpressionAttributeValues: {
        ":r": 0,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  console.log("Updated Branch in DynamoDB:", {
    id: updateRes.Attributes?.id,
    name: updateRes.Attributes?.name,
    code: updateRes.Attributes?.code,
    royalty_pct: updateRes.Attributes?.royalty_pct,
  });

  console.log("✅ Successfully updated Hyderabad Highway HQ royalty to 0% in DynamoDB!");
}

main().catch((err) => {
  console.error("Error setting HQ royalty:", err);
  process.exit(1);
});
