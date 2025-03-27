import { db, usersTable, conversationsTable } from '@enclaveid/db';
import { and, asc, eq, lte, not } from 'drizzle-orm';
import { generateEmbedding } from '../../services/generateEmbedding';
import { cosineDistance } from 'drizzle-orm';

const TOP_K_CONVERSATIONS = 5;
const MAX_DISTANCE = 0.2;

export async function POST(request: Request) {
  const { apiKey, title, content, id: conversationId } = await request.json();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.extension_api_key, apiKey),
  });

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // If the conversation content is the same as the existing conversation,
  // we don't need to insert or update it
  const existingConversation = await db.query.conversationsTable.findFirst({
    where: and(
      eq(conversationsTable.id, conversationId),
      eq(conversationsTable.user_id, user.id)
    ),
  });

  if (!existingConversation) {
    return new Response('Conversation not found or not owned by user', {
      status: 404,
    });
  }

  let embedding: number[];
  if (
    existingConversation &&
    existingConversation.content === content &&
    existingConversation.embedding
  ) {
    embedding = existingConversation.embedding;
  } else {
    embedding = await generateEmbedding(content);
  }

  const mostSimilarConversations = await db.transaction(async (tx) => {
    // Insert or update the conversation
    await tx
      .insert(conversationsTable)
      .values({
        id: conversationId,
        title,
        content,
        user_id: user.id,
        embedding,
      })
      .onConflictDoUpdate({
        target: [conversationsTable.id],
        set: {
          title,
          content,
          embedding,
          updated_at: new Date(),
        },
      });

    const distance = cosineDistance(conversationsTable.embedding, embedding);

    const result = await tx
      .select({
        id: conversationsTable.id,
        title: conversationsTable.title,
        created_at: conversationsTable.created_at,
        distance,
        user_id: usersTable.id,
        name: usersTable.name,
        meets_threshold: lte(distance, MAX_DISTANCE), // Add boolean flag indicating if meets threshold
      })
      .from(conversationsTable)
      .innerJoin(usersTable, eq(conversationsTable.user_id, usersTable.id))
      .where(
        // Exclude the conversation we just inserted
        // and the user's own conversations
        and(
          not(eq(conversationsTable.id, conversationId)),
          not(eq(usersTable.id, user.id))
        )
      )
      .orderBy(asc(distance))
      .limit(TOP_K_CONVERSATIONS);

    return result;
  });

  return new Response(JSON.stringify(mostSimilarConversations), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
