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
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';
export interface GeminiAskInput {
    /** The user's question. */
    prompt: string;
    /** System-level prompt that anchors the assistant in role context. */
    systemInstruction: string;
    /** Model selector. Defaults to flash for Starter, pro for Pro plan. */
    model?: GeminiModel;
    /** Caps the response length. Defaults to 800 tokens (~600 words). */
    maxOutputTokens?: number;
}
export interface GeminiAskOutput {
    /** The model's full text response. */
    text: string;
    /** Total tokens billed (input + output). */
    usageTokens: number;
    /** Echo of the model used. */
    model: GeminiModel;
}
export declare class GeminiNotConfiguredError extends Error {
    constructor();
}
export declare class GeminiApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/**
 * Returns true when the Gemini-side env is configured. Used by the status
 * endpoint so the UI can show "Copilot offline" gracefully rather than
 * 500ing on every prompt.
 */
export declare function isGeminiConfigured(): boolean;
export declare function askGemini(input: GeminiAskInput): Promise<GeminiAskOutput>;
//# sourceMappingURL=gemini-client.d.ts.map