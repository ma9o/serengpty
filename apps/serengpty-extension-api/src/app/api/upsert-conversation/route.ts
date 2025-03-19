import { db } from '../../services/db';
import { eq, not } from 'drizzle-orm';
import { usersTable, conversationsTable } from '../../services/db/schema';
import { generateEmbedding } from '../../services/embeddings/generateEmbedding';
import { cosineDistance } from 'drizzle-orm';

const topKConversations = 5;

export async function POST(request: Request) {
  const { apiToken, title, content, conversationId } = await request.json();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.apiToken, apiToken),
  });

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const embedding = await generateEmbedding(content);

  await db
    .insert(conversationsTable)
    .values({
      id: conversationId,
      title,
      content,
      userId: user.id,
      embedding,
    })
    .onConflictDoUpdate({
      target: [conversationsTable.id],
      set: {
        title,
        content,
        embedding,
        updatedAt: new Date(),
      },
    });

  const mostSimilarConversations = await db
    .select({
      conversationId: conversationsTable.id,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      userId: usersTable.id,
      userName: usersTable.name,
    })
    .from(conversationsTable)
    .innerJoin(usersTable, eq(conversationsTable.userId, usersTable.id))
    .where(
      // Exclude the conversation we just inserted
      not(eq(conversationsTable.id, conversationId))
    )
    .orderBy(cosineDistance(conversationsTable.embedding, embedding))
    .limit(topKConversations);

  return new Response(JSON.stringify(mostSimilarConversations), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
