import AWS from "aws-sdk";

const s3 = new AWS.S3({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const BUCKET_NAME = process.env.S3_CASE_REQUEST_BUCKET_NAME!;

export interface S3UploadOptions {
    folder?: string;         // e.g. "uploads", "documents"
    contentType?: string;    // override auto-detection
    metadata?: Record<string, string>;
}

export interface S3UploadResult {
    key: string;             // full S3 key (e.g. "uploads/1234-invoice.pdf")
    bucket: string;
    location: string;        // s3://bucket/key
}

// Content-Type Helper
function resolveContentType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        tiff: "image/tiff",
        tif: "image/tiff",
    };
    return map[ext] ?? "application/octet-stream";
}

/**
 * Uploads a file buffer to S3 and returns the resulting key and location.
 *
 * @example
 * const { key } = await uploadFileToS3(buffer, "invoice.pdf", { folder: "uploads" });
 */
export async function uploadFileToS3(
    fileBuffer: Buffer,
    fileName: string,
    options: S3UploadOptions = {}
): Promise<S3UploadResult> {
    const { folder = "uploads", contentType, metadata } = options;

    const sanitizedName = fileName.replace(/\s+/g, "-");
    const key = `${folder}/${Date.now()}-${sanitizedName}`;

    await s3
        .putObject({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType ?? resolveContentType(fileName),
            ...(metadata && { Metadata: metadata }),
        })
        .promise();

    console.log(`[S3] Uploaded: s3://${BUCKET_NAME}/${key}`);

    return {
        key,
        bucket: BUCKET_NAME,
        location: `s3://${BUCKET_NAME}/${key}`,
    };
}

// Delete
/**
 * Deletes an object from S3 by key.
 */
export async function deleteFileFromS3(key: string): Promise<void> {
    await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();
    console.log(`[S3] Deleted: ${key}`);
}

// Presigned URL (optional utility)
/**
 * Generates a presigned GET URL for temporary access to a private object.
 *
 * @param key        S3 object key
 * @param expiresIn  Seconds until URL expires (default: 3600)
 */
export function getPresignedUrl(key: string, expiresIn = 3600): string {
    return s3.getSignedUrl("getObject", {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: expiresIn,
    });
}