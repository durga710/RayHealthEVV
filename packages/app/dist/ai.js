import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
// Claude Haiku 4.5 on Bedrock — fast, cost-effective, HIPAA-eligible on us-east-1/us-west-2.
// Cross-region inference prefix (us.*) enables automatic region failover.
const DEFAULT_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION ?? 'us-east-1',
    // Credentials fall through to the standard AWS credential chain:
    // env vars → ~/.aws/credentials → EC2/ECS/Lambda instance role.
    // On Vercel, set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars.
});
export const aiModel = bedrock(process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID);
//# sourceMappingURL=ai.js.map