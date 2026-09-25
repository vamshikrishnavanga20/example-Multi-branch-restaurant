// =============================================================================
// AWS Image Upload Helper (Replaces Supabase Storage)
// =============================================================================
// This file provides the `uploadImage` function used by components like
// AddDishModal and StructureView. It uses S3 pre-signed URLs for direct
// browser-to-S3 uploads (zero server bandwidth consumed).
// =============================================================================

/**
 * Uploads a file to S3 via a pre-signed URL.
 * 1. Requests a pre-signed upload URL from the backend.
 * 2. Uploads the file directly to S3.
 * 3. Returns the public CloudFront CDN URL.
 */
export const uploadImage = async (file: File): Promise<string> => {
  // 1. File size check (Max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("File exceeds maximum allowed size (5 MB).");
  }

  // 2. MIME type whitelist check
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    throw new Error("Invalid file type. Only JPEG, PNG, WEBP, and AVIF images are allowed.");
  }

  // 3. Request pre-signed upload URL from our API
  const presignedRes = await fetch('/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, fileType: file.type }),
  });

  if (!presignedRes.ok) {
    const errData = await presignedRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to get upload URL.');
  }

  const { uploadUrl, publicUrl } = await presignedRes.json();

  // 4. Upload directly to S3 using the pre-signed URL
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload image to storage.');
  }

  // 5. Return the public CDN URL for display
  return publicUrl;
};