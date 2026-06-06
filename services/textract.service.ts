import AWS from "aws-sdk";

const textract = new AWS.Textract({
    region: process.env.AWS_REGION,
});

export type TextractFeatureType = "TABLES" | "FORMS" | "QUERIES" | "SIGNATURES";
export interface TextractAnalysisOptions {
    featureTypes: TextractFeatureType[];
    createCsv?: boolean;       // true → table CSV output, false → plain text
    pollIntervalMs?: number;   // how often to poll job status (default: 2000ms)
}

export interface TextractAnalysisResult {
    output: string; // CSV string or plain text
    jobId: string;
}

// Internal Helpers
async function processDocumentPages(
    jobId: string,
    createCsv: boolean
): Promise<{ allBlocksMap: Record<string, AWS.Textract.Block>; allTableBlocks: AWS.Textract.Block[] }> {
    const allBlocksMap: Record<string, AWS.Textract.Block> = {};
    const allTableBlocks: AWS.Textract.Block[] = [];

    let nextToken: string | undefined;
    do {
        const response = await textract
            .getDocumentAnalysis({ JobId: jobId, NextToken: nextToken })
            .promise();

        for (const block of response.Blocks ?? []) {
            if (block.Id) allBlocksMap[block.Id] = block;

            const targetType = createCsv ? "TABLE" : "LINE";
            if (block.BlockType === targetType) {
                allTableBlocks.push(block);
            }
        }

        nextToken = response.NextToken;
    } while (nextToken);

    return { allBlocksMap, allTableBlocks };
}

function generateTableCsv(
    tableBlock: AWS.Textract.Block,
    blocksMap: Record<string, AWS.Textract.Block>,
    tableIndex: number
): string {
    const rows: Record<number, Record<number, string>> = {};

    for (const rel of tableBlock.Relationships ?? []) {
        if (rel.Type !== "CHILD") continue;

        for (const cellId of rel.Ids ?? []) {
            const cell = blocksMap[cellId];
            if (cell?.BlockType !== "CELL") continue;

            const rowIdx = cell.RowIndex ?? 0;
            const colIdx = cell.ColumnIndex ?? 0;

            if (!rows[rowIdx]) rows[rowIdx] = {};

            // Collect text from WORD children of this cell
            const words = (cell.Relationships ?? [])
                .filter((r) => r.Type === "CHILD")
                .flatMap((r) => r.Ids ?? [])
                .map((id) => blocksMap[id])
                .filter((b) => b?.BlockType === "WORD")
                .map((b) => b.Text ?? "");

            rows[rowIdx][colIdx] = words.join(" ");
        }
    }

    const sortedRows = Object.keys(rows)
        .map(Number)
        .sort((a, b) => a - b);

    const maxCol = Math.max(
        ...sortedRows.flatMap((r) => Object.keys(rows[r]).map(Number))
    );

    const csvLines = sortedRows.map((r) => {
        const cols = Array.from({ length: maxCol }, (_, i) => {
            const val = rows[r][i + 1] ?? "";
            // Escape commas and quotes for valid CSV
            return val.includes(",") || val.includes('"')
                ? `"${val.replace(/"/g, '""')}"`
                : val;
        });
        return cols.join(",");
    });

    return `Table ${tableIndex}\n${csvLines.join("\n")}\n\n`;
}

// Main Export

/**
 * Runs async Textract document analysis on an already-uploaded S3 object.
 *
 * @param s3Key       The S3 object key returned from uploadFileToS3()
 * @param s3Bucket    The S3 bucket name
 * @param options     Feature types, output format, poll interval
 *
 * @example
 * const { output } = await analyzeDocument(key, bucket, {
 *   featureTypes: ["TABLES"],
 *   createCsv: true,
 * });
 */
export async function analyzeDocument(
    s3Key: string,
    s3Bucket: string,
    options: TextractAnalysisOptions
): Promise<TextractAnalysisResult> {
    const { featureTypes, createCsv = true, pollIntervalMs = 2000 } = options;

    // Start the async job
    const startResponse = await textract
        .startDocumentAnalysis({
            DocumentLocation: {
                S3Object: { Bucket: s3Bucket, Name: s3Key },
            },
            FeatureTypes: featureTypes,
        })
        .promise();

    const jobId = startResponse.JobId!;
    console.log(`[Textract] Job started: ${jobId}`);

    // Poll until complete
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        const status = await textract
            .getDocumentAnalysis({ JobId: jobId })
            .promise();

        if (status.JobStatus === "SUCCEEDED") {
            console.log(`[Textract] Job succeeded: ${jobId}`);
            break;
        }

        if (status.JobStatus === "FAILED") {
            throw new Error(`[Textract] Job failed: ${jobId}`);
        }

        console.log(`[Textract] Job status: ${status.JobStatus}`);
    }

    // Fetch all pages
    const { allBlocksMap, allTableBlocks } = await processDocumentPages(jobId, createCsv);

    // Build output
    let output: string;

    if (createCsv) {
        output = allTableBlocks
            .map((block, i) => generateTableCsv(block, allBlocksMap, i + 1))
            .join("");
    } else {
        output = allTableBlocks
            .map((b) => b.Text ?? "")
            .join(" ");
    }

    return { output: output.trim(), jobId };
}