import { app, InvocationContext } from '@azure/functions';
import { getGeminiEmbedding } from '@enclaveid/shared-utils';
import { db, conversationsTable } from '@enclaveid/db';

export async function processGeminiEmbeddings(
  queueItem: { conversation_id: string; text: string },
  context: InvocationContext
): Promise<void> {
  try {
    const start = Date.now();
    const embedding = await getGeminiEmbedding(queueItem.text);

    await db
      .insert(conversationsTable)
      .values({
        id: queueItem.conversation_id,
        embedding,
      })
      .onConflictDoUpdate({
        target: [conversationsTable.id],
        set: {
          embedding,
        },
      });

    const duration = ((Date.now() - start) / 1000).toFixed(2);

    context.log(
      `Processed embedding for conversation ${queueItem.conversation_id} in ${duration}s`
    );
  } catch (error) {
    context.error(error);
  }
}

app.storageQueue('process-gemini-embeddings', {
  queueName: 'gemini-embedding-tasks',
  connection: `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`,
  handler: (queueItem: unknown, context: InvocationContext) =>
    processGeminiEmbeddings(
      queueItem as { conversation_id: string; text: string },
      context
    ),
});
