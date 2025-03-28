import { app, InvocationContext } from '@azure/functions';
import { getGeminiEmbedding } from '@enclaveid/shared-utils';
import { db, conversationsTable } from '@enclaveid/db';
import { loadPipelineResults } from '../utils/loadPipelineResult';
import { readParquet } from '../utils/readParquet';

export async function processGeminiEmbeddings(
  queueItem: { conversation_id: string; user_id: string },
  context: InvocationContext
): Promise<void> {
  try {
    const start = Date.now();

    const blobName = `dagster/conversation_summaries/${queueItem.user_id}.snappy`;
    const blobContent = await loadPipelineResults(blobName).then((buffer) =>
      readParquet(buffer)
    );

    const conversation = blobContent.find(
      (row) => row.conversation_id === queueItem.conversation_id
    );

    if (!conversation) {
      context.error(
        `Conversation ${queueItem.conversation_id} not found for user ${queueItem.user_id}`
      );
      return;
    }

    const text = conversation.datetime_conversations as string;

    if (!text) {
      context.error(
        `Text for conversation ${queueItem.conversation_id} not found for user ${queueItem.user_id}`
      );
      return;
    }

    const embedding = await getGeminiEmbedding(text);

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
      queueItem as { conversation_id: string; user_id: string },
      context
    ),
});
