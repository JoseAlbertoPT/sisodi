import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import type { Readable } from "stream"

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || "us-east-1",
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: process.env.AWS_USE_PATH_STYLE_ENDPOINT !== "false",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_BUCKET!
export async function s3Upload(key: string, body: Buffer, contentType?: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function s3Download(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const stream = res.Body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export function isS3NotFound(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } } | null
  return err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404
}

// false solo si el objeto no existe; cualquier otro error (credenciales, red) se propaga.
export async function s3Exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch (e) {
    if (isS3NotFound(e)) return false
    throw e
  }
}

export async function s3Delete(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch {
  }
}
