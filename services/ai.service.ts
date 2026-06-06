import axios from "axios";
const AI_KEY = process.env.CLAUDE_AI_KEY;
type AnthropicRole = "user" | "assistant";

interface AnthropicMessage {
    role: AnthropicRole;
    content: string;
}

interface AskQuestionParams {
    systemPrompt: string;
    userPrompt: string;
    modelName?: string;
    dbLog?: unknown; // keep flexible since not used here
}

interface AnthropicResponse {
    content: {
        text: string;
        type: string;
    }[];
}

export const askQuestionToAi = async ({
    systemPrompt,
    userPrompt,
    modelName = "claude-haiku-4-5-20251001",
    dbLog,
}: AskQuestionParams): Promise<string> => {
    console.log("Asking AI question...");
    console.log(systemPrompt);
    console.log(userPrompt);

    try {
        if (!AI_KEY) {
            throw new Error("CLAUDE_AI_KEY is not defined in environment variables");
        }

        const response = await axios.post<AnthropicResponse>(
            "https://api.anthropic.com/v1/messages",
            {
                model: modelName,
                system: systemPrompt,
                max_tokens: 4000,
                messages: [
                    {
                        role: "user",
                        content: userPrompt,
                    } as AnthropicMessage,
                ],
            },
            {
                headers: {
                    "x-api-key": AI_KEY,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
            }
        );

        const rawText = response.data.content?.[0]?.text ?? "";
        const data = sanitizeStringIfBackTicks(rawText);

        console.log(data);
        return data;
    } catch (error) {
        console.error("errorInAskingQuestion", error);
        throw error;
    }
};

const sanitizeStringIfBackTicks = (data: unknown): string => {
    if (typeof data !== "string") return String(data);

    let cleaned = data.trim();

    // Case 1: fenced code block
    if (cleaned.startsWith("```")) {
        cleaned = cleaned
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```$/i, "")
            .trim();
    }

    return cleaned;
};