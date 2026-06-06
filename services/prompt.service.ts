import { askQuestionToAi } from "@/services/ai.service";

export const processCvAnalyzationsPrompt = async (CV_ANALYZATION_SYSTEM_PROMPT: string, CV_ANALYZATION_USER_PROMPT: any
) => {
    return await askQuestionToAi({
        systemPrompt: CV_ANALYZATION_SYSTEM_PROMPT,
        userPrompt: CV_ANALYZATION_USER_PROMPT,
    });
}