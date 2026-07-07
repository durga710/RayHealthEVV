import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, type LanguageModel } from 'ai';

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

/**
 * Active Claude model on Bedrock.
 *
 * Default is the Claude Haiku 4.5 cross-region inference profile. AWS retired
 * the previous default (`anthropic.claude-3-5-haiku-20241022-v1:0`) as legacy,
 * so that id now returns a ValidationException, which is why onboarding and
 * the admin assistant were silently failing in prod. Override via
 * BEDROCK_MODEL_ID; the Pro copilot tier can override separately via
 * BEDROCK_MODEL_ID_PRO.
 */
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export const aiModel: LanguageModel = bedrock(BEDROCK_MODEL_ID);

/**
 * Bedrock is reachable when a Bedrock API key (bearer token) or SigV4
 * credentials are present. The provider auto-detects AWS_BEARER_TOKEN_BEDROCK.
 */
export function isBedrockConfigured(): boolean {
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  );
}

/**
 * True when the AI provider is usable.
 *
 * Bedrock (Claude) is the ONLY provider. PHI flows through these AI surfaces
 * (copilot, command-center briefing) and AWS is the only AI vendor under a
 * signed BAA, so there is deliberately no non-BAA fallback, if Bedrock is
 * not configured, the AI surfaces fail closed rather than routing PHI
 * elsewhere. The public Privacy policy states this; do not reintroduce a
 * fallback provider without legal/BAA review and a copy update.
 */
export function isAIConfigured(): boolean {
  return isBedrockConfigured();
}

export class AINotConfiguredError extends Error {
  constructor() {
    super('No AI provider configured (set AWS_BEARER_TOKEN_BEDROCK).');
    this.name = 'AINotConfiguredError';
  }
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
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
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
 * Bedrock (Claude) is the ONLY provider, see {@link isAIConfigured}. There
 * is intentionally no non-BAA fallback: PHI passes through here, and routing
 * it to a vendor without a signed BAA would be an unauthorized disclosure.
 * When Bedrock is not configured this throws {@link AINotConfiguredError} and
 * callers fail closed. Returns { text, usageTokens, model, provider }.
 */
export async function askAI(input: AskAIInput): Promise<AskAIOutput> {
  const maxOutputTokens = input.maxOutputTokens ?? 800;

  if (!isBedrockConfigured()) {
    throw new AINotConfiguredError();
  }

  const modelId =
    input.tier === 'pro' && process.env.BEDROCK_MODEL_ID_PRO
      ? process.env.BEDROCK_MODEL_ID_PRO
      : BEDROCK_MODEL_ID;
  const model = modelId === BEDROCK_MODEL_ID ? aiModel : bedrock(modelId);

  const result = await generateText({
    model,
    system: input.systemInstruction,
    // Multi-turn history when provided, else the single prompt.
    ...(input.messages ? { messages: input.messages } : { prompt: input.prompt ?? '' }),
    maxOutputTokens,
    temperature: 0.4,
  });

  const usage = result.usage as
    | { totalTokens?: number; inputTokens?: number; outputTokens?: number }
    | undefined;
  const usageTokens =
    usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);

  return { text: result.text, usageTokens, model: modelId, provider: 'bedrock' };
}
