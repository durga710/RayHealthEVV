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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** Runtime allowlist of accepted models. The TS union below is erased at
 * runtime, so callers that pass request-derived values MUST be validated
 * against this list before the value reaches the request URL. */
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const

export type GeminiModel = (typeof GEMINI_MODELS)[number]

export function isGeminiModel(value: unknown): value is GeminiModel {
  return typeof value === 'string' && (GEMINI_MODELS as readonly string[]).includes(value)
}

export interface GeminiAskInput {
  /** The user's question. */
  prompt: string
  /** System-level prompt that anchors the assistant in role context. */
  systemInstruction: string
  /** Model selector. Defaults to flash for Starter, pro for Pro plan. */
  model?: GeminiModel
  /** Caps the response length. Defaults to 800 tokens (~600 words). */
  maxOutputTokens?: number
}

export interface GeminiAskOutput {
  /** The model's full text response. */
  text: string
  /** Total tokens billed (input + output). */
  usageTokens: number
  /** Echo of the model used. */
  model: GeminiModel
}

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('GOOGLE_AI_API_KEY is not set; Copilot cannot reach Gemini.')
    this.name = 'GeminiNotConfiguredError'
  }
}

export class GeminiApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'GeminiApiError'
  }
}

/**
 * Returns true when the Gemini-side env is configured. Used by the status
 * endpoint so the UI can show "Copilot offline" gracefully rather than
 * 500ing on every prompt.
 */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY)
}

interface GeminiCandidatePart {
  text?: string
}

interface GeminiCandidateContent {
  parts?: GeminiCandidatePart[]
}

interface GeminiCandidate {
  content?: GeminiCandidateContent
}

interface GeminiUsage {
  totalTokenCount?: number
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[]
  usageMetadata?: GeminiUsage
}

export async function askGemini(input: GeminiAskInput): Promise<GeminiAskOutput> {
  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new GeminiNotConfiguredError()
  }

  // Sanitize at the sink: `model` is interpolated into the request URL, so
  // reject anything outside the allowlist even though the type says it is a
  // GeminiModel (types are erased and callers may pass request-derived input).
  const model: GeminiModel = isGeminiModel(input.model) ? input.model : 'gemini-2.5-flash'
  const maxOutputTokens = input.maxOutputTokens ?? 800

  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [
      {
        role: 'user' as const,
        parts: [{ text: input.prompt }],
      },
    ],
    systemInstruction: {
      role: 'system' as const,
      parts: [{ text: input.systemInstruction }],
    },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new GeminiApiError(response.status, text.slice(0, 500))
  }

  const data = (await response.json()) as GeminiResponseBody
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) {
    throw new GeminiApiError(502, 'Gemini returned an empty response')
  }
  return {
    text,
    usageTokens: data.usageMetadata?.totalTokenCount ?? 0,
    model,
  }
}
