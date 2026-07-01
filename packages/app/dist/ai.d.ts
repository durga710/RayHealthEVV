import { type LanguageModel } from 'ai';
/**
 * Active Claude model on Bedrock.
 *
 * Default is the Claude Haiku 4.5 cross-region inference profile. AWS retired
 * the previous default (`anthropic.claude-3-5-haiku-20241022-v1:0`) as legacy,
 * so that id now returns a ValidationException — which is why onboarding and
 * the admin assistant were silently failing in prod. Override via
 * BEDROCK_MODEL_ID; the Pro copilot tier can override separately via
 * BEDROCK_MODEL_ID_PRO.
 */
export declare const BEDROCK_MODEL_ID: string;
export declare const aiModel: LanguageModel;
/**
 * Bedrock is reachable when a Bedrock API key (bearer token) or SigV4
 * credentials are present. The provider auto-detects AWS_BEARER_TOKEN_BEDROCK.
 */
export declare function isBedrockConfigured(): boolean;
/**
 * True when the AI provider is usable.
 *
 * Bedrock (Claude) is the ONLY provider. PHI flows through these AI surfaces
 * (copilot, command-center briefing) and AWS is the only AI vendor under a
 * signed BAA, so there is deliberately no non-BAA fallback — if Bedrock is
 * not configured, the AI surfaces fail closed rather than routing PHI
 * elsewhere. The public Privacy policy states this; do not reintroduce a
 * fallback provider without legal/BAA review and a copy update.
 */
export declare function isAIConfigured(): boolean;
export declare class AINotConfiguredError extends Error {
    constructor();
}
export interface AskAIInput {
    /** The user's question / instruction. Used for single-turn calls. */
    prompt?: string;
    /**
     * Multi-turn conversation history (oldest first, last entry must be the
     * current user turn). When provided, takes precedence over `prompt` so
     * chat surfaces (e.g. the marketing support chat) keep context. Either
     * `prompt` or `messages` must be set.
     */
    messages?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    /** System prompt anchoring the assistant's role + guardrails. */
    systemInstruction: string;
    /** 'pro' routes to a stronger model when one is configured. */
    tier?: 'starter' | 'pro';
    /** Response length cap. Defaults to 800 tokens. */
    maxOutputTokens?: number;
}
export interface AskAIOutput {
    text: string;
    usageTokens: number;
    model: string;
    provider: 'bedrock';
}
/**
 * Single-turn ask used by the Copilot and command-center briefing.
 *
 * Bedrock (Claude) is the ONLY provider — see {@link isAIConfigured}. There
 * is intentionally no non-BAA fallback: PHI passes through here, and routing
 * it to a vendor without a signed BAA would be an unauthorized disclosure.
 * When Bedrock is not configured this throws {@link AINotConfiguredError} and
 * callers fail closed. Returns { text, usageTokens, model, provider }.
 */
export declare function askAI(input: AskAIInput): Promise<AskAIOutput>;
//# sourceMappingURL=ai.d.ts.map