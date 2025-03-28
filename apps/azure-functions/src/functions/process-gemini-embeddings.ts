import { app, InvocationContext } from '@azure/functions';
import { getGeminiEmbedding } from '@enclaveid/shared-utils';
import { db, conversationsTable } from '@enclaveid/db';
import { loadPipelineResults } from '../utils/loadPipelineResult';
import { readParquet } from '../utils/readParquet';

export async function processGeminiEmbeddings(
  queueItem: { conversation_id: string; user_id: string },
  context: InvocationContext
): Promise<void> {
  const logger = process.env.NODE_ENV === 'development' ? console : context;
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
      throw new Error(
        `Conversation ${queueItem.conversation_id} not found for user ${queueItem.user_id}`
      );
    }

    const text = conversation.datetime_conversations as string;

    if (!text) {
      throw new Error(
        `Text for conversation ${queueItem.conversation_id} not found for user ${queueItem.user_id}`
      );
    }

    const embedding = await getGeminiEmbedding(text);

    const { summary, title, start_date } = conversation as {
      summary: string;
      title: string;
      start_date: string;
    };
    const datetime = new Date(start_date);

    await db
      .insert(conversationsTable)
      .values({
        id: queueItem.conversation_id,
        userId: queueItem.user_id,
        summary,
        title,
        datetime,
        content: text,
        embedding,
      })
      .onConflictDoUpdate({
        target: [conversationsTable.id],
        set: {
          summary,
          title,
          datetime,
          content: text,
          embedding,
        },
      });

    const duration = ((Date.now() - start) / 1000).toFixed(2);

    logger.log(
      `Processed embedding for conversation ${queueItem.conversation_id} in ${duration}s`
    );
  } catch (error) {
    logger.error(error);
  }
}

app.storageQueue('process-gemini-embeddings', {
  queueName: 'gemini-embedding-tasks',
  connection: 'AzureWebJobsStorage',
  handler: (queueItem: unknown, context: InvocationContext) =>
    processGeminiEmbeddings(
      queueItem as { conversation_id: string; user_id: string },
      context
    ),
});
