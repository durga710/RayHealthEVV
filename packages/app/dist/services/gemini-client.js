/**
 * Gemini API client — minimal REST wrapper for the Copilot endpoint.
 *
 * Uses fetch + GOOGLE_AI_API_KEY env var. No SDK dependency — keeps the
 * platform package's dep tree small and avoids version-skew issues with
 * Google's experimental SDKs. Swap to @google/genai when their API
 * stabilizes if we need streaming or function-calling.
 *
 * Per brand: gemini-2.5-flash is the default for the conversational Q&A
 * surface (cheap, fast). The Pro tier of the Copilot add-on routes to
 * gemini-2.5-pro for the multi-step workflow agent.
 */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export class GeminiNotConfiguredError extends Error {
    constructor() {
        super('GOOGLE_AI_API_KEY is not set; Copilot cannot reach Gemini.');
        this.name = 'GeminiNotConfiguredError';
    }
}
export class GeminiApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'GeminiApiError';
    }
}
/**
 * Returns true when the Gemini-side env is configured. Used by the status
 * endpoint so the UI can show "Copilot offline" gracefully rather than
 * 500ing on every prompt.
 */
export function isGeminiConfigured() {
    return Boolean(process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY);
}
export async function askGemini(input) {
    const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new GeminiNotConfiguredError();
    }
    const model = input.model ?? 'gemini-2.5-flash';
    const maxOutputTokens = input.maxOutputTokens ?? 800;
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
        contents: [
            {
                role: 'user',
                parts: [{ text: input.prompt }],
            },
        ],
        systemInstruction: {
            role: 'system',
            parts: [{ text: input.systemInstruction }],
        },
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens,
        },
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new GeminiApiError(response.status, text.slice(0, 500));
    }
    const data = (await response.json());
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) {
        throw new GeminiApiError(502, 'Gemini returned an empty response');
    }
    return {
        text,
        usageTokens: data.usageMetadata?.totalTokenCount ?? 0,
        model,
    };
}
//# sourceMappingURL=gemini-client.js.map