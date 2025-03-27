import { createAzure } from '@ai-sdk/azure';

export const azureAi = createAzure({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  resourceName: 'enclaveidai2163546968',
});
