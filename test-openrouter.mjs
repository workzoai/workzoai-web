// Standalone test — run from your project root with:
//   node test-openrouter.mjs
//
// This loads OPENROUTER_API_KEY from .env.local manually (no Next.js needed)
// and makes ONE real call to OpenRouter with the exact same shape used by
// workzoAiCvParser.ts, so we can see the raw response/error directly.

import { readFileSync } from "fs";
import OpenAI from "openai";

// ── Load .env.local manually ──────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const content = readFileSync(".env.local", "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (e) {
    console.error("Could not read .env.local:", e.message);
  }
}

loadEnvLocal();

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.WORKZO_CV_AI_MODEL || "anthropic/claude-sonnet-4.6";

console.log("Using model:", model);
console.log("Key present:", Boolean(apiKey), apiKey ? `(${apiKey.slice(0, 8)}...${apiKey.slice(-4)})` : "");

if (!apiKey) {
  console.error("OPENROUTER_API_KEY not found in .env.local");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

const SAMPLE_CV = `OLIVIA WILSON
PR MANAGER
+123-456-7890 | hello@reallygreatsite.com | 123 Anywhere St., Any City

PROFILE
Results-driven PR Manager with over 5 years of experience.

EXPERIENCE
Borcelle | January 2020 - Present
PR Manager
- Developed and executed PR strategies for high-profile clients.

SKILLS
Media Relations, Crisis Communication, Brand Management`;

async function main() {
  try {
    console.log("\n--- Sending request to OpenRouter ---\n");

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a resume extraction engine. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Return ONLY valid JSON with this exact shape: {"basics":{"name":"","headline":""},"experience":[{"title":"","company":"","dates":""}]}\n\nCV text:\n${SAMPLE_CV}`,
        },
      ],
    });

    console.log("--- RAW RESPONSE OBJECT ---");
    console.log(JSON.stringify(response, null, 2));

    const content = response.choices?.[0]?.message?.content || "";
    console.log("\n--- MESSAGE CONTENT ---");
    console.log(content);

    try {
      const parsed = JSON.parse(content);
      console.log("\n--- PARSED JSON ---");
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log("\n--- JSON.parse FAILED ---");
      console.log(e.message);
    }
  } catch (error) {
    console.error("\n--- ERROR ---");
    console.error("Message:", error?.message);
    console.error("Status:", error?.status);
    console.error("Code:", error?.code);
    console.error("Type:", error?.type);
    if (error?.error) {
      console.error("error.error:", JSON.stringify(error.error, null, 2));
    }
    console.error("\nFull error object:");
    console.error(error);
  }
}

main();
