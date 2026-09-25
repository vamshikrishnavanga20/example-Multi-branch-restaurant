// =============================================================================
// AWS Cognito Identity Provider Integration
// Authenticates branch managers and provisions branch credentials
// =============================================================================

import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "./config";

const region = AWS_REGION;
const accessKeyId = AWS_ACCESS_KEY_ID;
const secretAccessKey = AWS_SECRET_ACCESS_KEY;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

// Cognito Client (configured using AWS IAM Server Credentials)
export const cognitoClient = new CognitoIdentityProviderClient({
  region,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
});

/**
 * Checks if AWS Cognito environment variables are fully configured.
 */
export function isCognitoConfigured(): boolean {
  return Boolean(
    userPoolId &&
    clientId &&
    accessKeyId &&
    secretAccessKey &&
    userPoolId.trim().length > 0 &&
    clientId.trim().length > 0
  );
}

export interface CognitoAuthResult {
  success: boolean;
  error?: string;
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  isCognito: boolean;
}

/**
 * Authenticates a branch manager against AWS Cognito User Pool.
 * If Cognito is not configured, returns isCognito: false to trigger fallback.
 */
export async function authenticateBranchWithCognito(
  username: string,
  password: string
): Promise<CognitoAuthResult> {
  if (!isCognitoConfigured()) {
    return {
      success: false,
      isCognito: false,
      error: "Cognito User Pool is not configured in environment variables.",
    };
  }

  try {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      return {
        success: true,
        isCognito: true,
        idToken: response.AuthenticationResult.IdToken,
        accessToken: response.AuthenticationResult.AccessToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
      };
    }

    if (response.ChallengeName) {
      return {
        success: false,
        isCognito: true,
        error: `Cognito challenge required: ${response.ChallengeName}`,
      };
    }

    return {
      success: false,
      isCognito: true,
      error: "Authentication failed. Invalid branch credentials.",
    };
  } catch (err: any) {
    console.warn(`[Cognito] Auth error for ${username}:`, err.message || err);
    return {
      success: false,
      isCognito: true,
      error: err.message || "Invalid branch credentials.",
    };
  }
}

export interface ProvisionBranchUserParams {
  branchId: string;
  branchCode?: string;
  managerEmail?: string;
  password?: string;
}

/**
 * Provisions or updates a Branch Manager user in AWS Cognito.
 * Gracefully skips if Cognito is not enabled.
 */
export async function createOrUpdateBranchCognitoUser({
  branchId,
  branchCode,
  managerEmail,
  password,
}: ProvisionBranchUserParams): Promise<{ success: boolean; message: string }> {
  if (!isCognitoConfigured() || !password) {
    return {
      success: false,
      message: "Cognito not configured or no password provided. Stored locally in DynamoDB.",
    };
  }

  const username = branchId;
  const email = managerEmail && managerEmail.includes("@") ? managerEmail : `manager.${branchCode || branchId}@s4manohaa.com`;

  try {
    // Check if user already exists
    let userExists = false;
    try {
      await cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );
      userExists = true;
    } catch (e: any) {
      if (e.name === "UserNotFoundException") {
        userExists = false;
      } else {
        throw e;
      }
    }

    if (!userExists) {
      // Create user
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: username,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
            { Name: "custom:branch_id", Value: branchId },
            { Name: "custom:role", Value: "manager" },
          ],
          MessageAction: "SUPPRESS", // Do not send invite email
        })
      );
    }

    // Set permanent password
    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: username,
        Password: password,
        Permanent: true,
      })
    );

    return {
      success: true,
      message: `Branch user ${username} successfully synchronized with AWS Cognito.`,
    };
  } catch (err: any) {
    console.warn(`[Cognito] Failed to sync user ${username}:`, err.message || err);
    return {
      success: false,
      message: err.message || "Failed to synchronize with Cognito.",
    };
  }
}
