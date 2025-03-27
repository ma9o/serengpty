import { app, InvocationContext } from '@azure/functions';

export async function processGeminiEmbeddings(
  queueItem: unknown,
  context: InvocationContext
): Promise<void> {
  context.log('Storage queue function processed work item:', queueItem);
}

app.storageQueue('process-gemini-embeddings', {
  queueName: 'gemini-embedding-tasks',
  connection: `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`,
  handler: processGeminiEmbeddings,
});
