type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AskOpenRouterOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** When true, requests OpenRouter's JSON object response format. The
   * system/user prompt must still instruct the model on the exact JSON
   * shape expected — this only sets the API-level constraint that the
   * response must be valid JSON, it does not define the schema itself. */
  jsonMode?: boolean;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function askOpenRouter(
  messages: OpenRouterMessage[],
  options: AskOpenRouterOptions = {},
) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const model = options.model || process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4-6";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://workzoai.com",
      "X-Title": "WorkZo AI",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.25,
      max_tokens: options.maxTokens ?? 900,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OpenRouter failed: ${response.status} ${text}`);
  }

  let data: OpenRouterResponse;

  try {
    data = JSON.parse(text) as OpenRouterResponse;
  } catch {
    throw new Error("OpenRouter returned invalid JSON.");
  }

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}
