// =============================================================================
// AWS S3 Client — Pre-Signed Upload & CloudFront URL Helpers
// =============================================================================

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "manohaa-hotel-assets";
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "";

// Allowed MIME types for upload security
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Generates a pre-signed S3 upload URL for direct browser upload.
 * The browser uploads directly to S3; no server bandwidth consumed.
 */
export async function generatePresignedUploadUrl(
  originalFileName: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  // Validate MIME type
  if (!ALLOWED_TYPES.includes(contentType.toLowerCase())) {
    throw new Error("Invalid file type. Only JPEG, PNG, WEBP, and AVIF are allowed.");
  }

  // Generate a secure, unique filename
  const cleanExt = (originalFileName.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const key = `dishes/${crypto.randomUUID()}.${cleanExt}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  // Public URL via CloudFront CDN (or direct S3 fallback)
  const publicUrl = CLOUDFRONT_DOMAIN
    ? `https://${CLOUDFRONT_DOMAIN}/${key}`
    : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;

  return { uploadUrl, publicUrl, key };
}

/**
 * Returns a CloudFront-accelerated public URL for a given S3 object key.
 */
export function getPublicUrl(key: string): string {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`;
  }
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
}
