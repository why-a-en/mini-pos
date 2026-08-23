import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 speaks the S3 API — see docs/TECH_STACK.md.
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

/**
 * A short-lived URL the browser can PUT an image to directly, bypassing our
 * server entirely. Deliberate for mobile: proxying image bytes through a
 * serverless function adds a payload/time-limit ceiling that's a bad fit for
 * the slow/variable mobile networks this app targets (docs/TECH_STACK.md §6)
 * — direct-to-R2 upload with client-side retry is more resilient.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  return { uploadUrl, publicUrl: getPublicUrl(key) };
}

export function getPublicUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/** Namespaced, collision-resistant object key for an uploaded image. */
export function buildImageKey(
  organizationId: string,
  kind: "product" | "order",
  filename: string,
): string {
  const ext = filename.split(".").pop() ?? "jpg";
  const random = crypto.randomUUID();
  return `${organizationId}/${kind}/${random}.${ext}`;
}
