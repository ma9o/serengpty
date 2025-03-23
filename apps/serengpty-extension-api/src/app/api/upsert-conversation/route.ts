import { db } from '../../services/db';
import { and, eq, not } from 'drizzle-orm';
import { usersTable, conversationsTable } from '../../services/db/schema';
import { generateEmbedding } from '../../services/generateEmbedding';
import { cosineDistance, desc } from 'drizzle-orm';

const topKConversations = 5;

export async function POST(request: Request) {
  const { userId, title, content, id: conversationId } = await request.json();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const embedding = await generateEmbedding(content);

  const mostSimilarConversations = await db.transaction(async (tx) => {
    // Insert or update the conversation
    await tx
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

    const distance = cosineDistance(conversationsTable.embedding, embedding);

    return await tx
      .select({
        id: conversationsTable.id,
        title: conversationsTable.title,
        createdAt: conversationsTable.createdAt,
        distance,
        userId: usersTable.id,
        userName: usersTable.name,
      })
      .from(conversationsTable)
      .innerJoin(usersTable, eq(conversationsTable.userId, usersTable.id))
      .where(
        // Exclude the conversation we just inserted
        // and the user's own conversations
        and(
          not(eq(conversationsTable.id, conversationId)),
          not(eq(usersTable.id, userId))
        )
      )
      .orderBy(desc(distance))
      .limit(topKConversations);
  });

  return new Response(JSON.stringify(mostSimilarConversations), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
