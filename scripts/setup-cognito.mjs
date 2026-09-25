#!/usr/bin/env node
// =============================================================================
// AWS Cognito Setup Script for S4 Manohaa Food Plaza
// Creates User Pool, App Client, and provisions Branch Manager accounts.
//
// Usage: node scripts/setup-cognito.mjs
// =============================================================================

import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const region = process.env.AWS_REGION || "ap-south-2";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error("❌ Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env.local");
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const DEFAULT_BRANCHES = [
  {
    id: "branch-hyderabad-hq",
    code: "HYD-01",
    name: "Hyderabad Highway HQ",
    email: "hyderabad@s4manohaa.com",
    password: process.env.HYD_BRANCH_PASSWORD || "Manohaa@Hyd2026!",
  },
  {
    id: "branch-bodhgaya-highway-express-9cba",
    code: "BDG-02",
    name: "Bodhgaya Highway Express",
    email: "bodhgaya@s4manohaa.com",
    password: process.env.BDG_BRANCH_PASSWORD || "Manohaa@Bdg2026!",
  },
];

async function setup() {
  console.log("============================================================");
  console.log("   S4 MANOHAA — AWS COGNITO USER POOL AUTOMATED SETUP");
  console.log(`   Region: ${region}`);
  console.log("============================================================\n");

  let userPoolId = process.env.COGNITO_USER_POOL_ID;
  let clientId = process.env.COGNITO_CLIENT_ID;

  try {
    if (!userPoolId) {
      console.log("1. Creating Cognito User Pool (ManohaaHotelBranches)...");
      const poolRes = await client.send(
        new CreateUserPoolCommand({
          PoolName: "ManohaaHotelBranches",
          Policies: {
            PasswordPolicy: {
              MinimumLength: 8,
              RequireUppercase: false,
              RequireLowercase: false,
              RequireNumbers: true,
              RequireSymbols: false,
            },
          },
          AutoVerifiedAttributes: ["email"],
          Schema: [
            {
              Name: "branch_id",
              AttributeDataType: "String",
              Mutable: true,
              Required: false,
            },
            {
              Name: "role",
              AttributeDataType: "String",
              Mutable: true,
              Required: false,
            },
          ],
        })
      );

      userPoolId = poolRes.UserPool?.Id;
      console.log(`   ✅ User Pool created: ${userPoolId}`);
    } else {
      console.log(`1. Using existing User Pool: ${userPoolId}`);
    }

    if (!clientId) {
      console.log("\n2. Creating App Client for Serverless Admin...");
      const clientRes = await client.send(
        new CreateUserPoolClientCommand({
          UserPoolId: userPoolId,
          ClientName: "ManohaaHotelWebClient",
          GenerateSecret: false,
          ExplicitAuthFlows: [
            "ALLOW_ADMIN_USER_PASSWORD_AUTH",
            "ALLOW_USER_PASSWORD_AUTH",
            "ALLOW_REFRESH_TOKEN_AUTH",
          ],
        })
      );

      clientId = clientRes.UserPoolClient?.ClientId;
      console.log(`   ✅ App Client created: ${clientId}`);
    } else {
      console.log(`\n2. Using existing App Client: ${clientId}`);
    }

    console.log("\n3. Provisioning Branch Managers in Cognito...");
    for (const b of DEFAULT_BRANCHES) {
      try {
        console.log(`   - Setting up branch: ${b.name} (${b.id})...`);
        await client.send(
          new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: b.id,
            UserAttributes: [
              { Name: "email", Value: b.email },
              { Name: "email_verified", Value: "true" },
              { Name: "custom:branch_id", Value: b.id },
              { Name: "custom:role", Value: "manager" },
            ],
            MessageAction: "SUPPRESS",
          })
        );
      } catch (err) {
        if (err.name !== "UsernameExistsException") {
          console.warn(`     Notice creating ${b.id}:`, err.message);
        }
      }

      // Set password
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: b.id,
          Password: b.password,
          Permanent: true,
        })
      );
      console.log(`     ✅ Password set for ${b.id}: ${b.password}`);
    }

    console.log("\n============================================================");
    console.log("🎉 COGNITO SETUP COMPLETE!");
    console.log("Add the following lines to your .env.local file:");
    console.log("------------------------------------------------------------");
    console.log(`COGNITO_USER_POOL_ID=${userPoolId}`);
    console.log(`COGNITO_CLIENT_ID=${clientId}`);
    console.log("============================================================\n");
  } catch (error) {
    console.error("\n❌ Cognito Setup failed:", error.message);
    if (error.name === "AccessDeniedException" || error.message?.includes("is not authorized")) {
      console.log("\n💡 IAM Permission Notice:");
      console.log("   The IAM user needs permission: cognito-idp:*");
      console.log("   Attach 'AmazonCognitoPowerUser' to your IAM user in the AWS Console.");
      console.log("   In the meantime, the application seamlessly uses the DynamoDB fallback!");
    }
  }
}

setup();
