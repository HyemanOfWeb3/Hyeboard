import { S3Client } from "@aws-sdk/client-s3";

export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_NOTE = 10;
export const ATTACHMENT_URL_TTL_SECONDS = 300;
export const SUPPORTED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export function getAttachmentBucket() {
  return process.env.ATTACHMENT_BUCKET || process.env.S3_BUCKET || "";
}

export function getObjectStorageClient() {
  const region = process.env.S3_REGION || process.env.AWS_REGION;
  const bucket = getAttachmentBucket();
  if (
    !region ||
    !bucket ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  ) {
    throw new Error("Object storage is not configured");
  }
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    }),
  };
}
