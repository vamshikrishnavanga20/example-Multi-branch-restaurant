import { NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/aws/s3";
import { verifySession } from "@/lib/aws/auth";

// POST: Generate a pre-signed S3 upload URL
// The browser then uploads directly to S3 (zero server bandwidth consumed)
export async function POST(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { fileName, fileType } = await req.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "fileName and fileType are required." }, { status: 400 });
    }

    const { uploadUrl, publicUrl, key } = await generatePresignedUploadUrl(fileName, fileType);

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error: any) {
    console.error("Presigned Upload Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL." },
      { status: 500 }
    );
  }
}
