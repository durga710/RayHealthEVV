import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { LanguageModel } from 'ai';

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

// Default: Claude 3.5 Haiku on Bedrock (widely available, no cross-region inference required).
// Override via BEDROCK_MODEL_ID env var.
export const aiModel: LanguageModel = bedrock(
  process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-5-haiku-20241022-v1:0'
);
