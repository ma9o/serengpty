import { db, usersTable, conversationsTable } from '@enclaveid/db';
import { and, asc, eq, lte, not } from 'drizzle-orm';
import { cosineDistance } from 'drizzle-orm';
import { getGeminiEmbedding } from '@enclaveid/shared-node';

const TOP_K_CONVERSATIONS = 5;
const MAX_DISTANCE = 0.2; // Corresponds to a minimum similarity of 0.8
const MIN_RELEVANT_SIMILARITY = 0.5;

function scaleSimilarity(distance: number) {
  const similarity = 1 - distance;

  if (similarity >= MIN_RELEVANT_SIMILARITY) {
    return (similarity - MIN_RELEVANT_SIMILARITY) * 2;
  } else {
    return 0;
  }
}

export async function POST(request: Request) {
  const { apiKey, title, content, id: conversationId } = await request.json();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.extensionApiKey, apiKey),
  });

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const existingConversation = await db.query.conversationsTable.findFirst({
    where: and(
      eq(conversationsTable.id, conversationId),
      eq(conversationsTable.userId, user.id)
    ),
  });

  if (existingConversation) {
    if (existingConversation.userId !== user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let embedding: number[];
  if (
    existingConversation &&
    existingConversation.content === content &&
    existingConversation.embedding
  ) {
    embedding = existingConversation.embedding;
  } else {
    embedding = await getGeminiEmbedding(content);
  }

  const rawResults = await db.transaction(async (tx) => {
    // Renamed variable
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

    // Fetch raw results including distance
    const result = await tx
      .select({
        id: conversationsTable.id,
        title: conversationsTable.title,
        createdAt: conversationsTable.createdAt,
        distance,
        userId: usersTable.id,
        name: usersTable.name,
        meetsThreshold: lte(distance, MAX_DISTANCE),
      })
      .from(conversationsTable)
      .innerJoin(usersTable, eq(conversationsTable.userId, usersTable.id))
      .where(
        and(
          not(eq(conversationsTable.id, conversationId)),
          not(eq(usersTable.id, user.id))
        )
      )
      .orderBy(asc(distance))
      .limit(TOP_K_CONVERSATIONS);

    return result;
  });

  // --- Scaling Step ---
  const scaledResults = rawResults.map((result) => {
    const scaledSimilarity = scaleSimilarity(result.distance as number);
    return {
      ...result,
      scaledSimilarity: scaledSimilarity,
    };
  });

  // If the result set is mixed (some meet threshold, some don't),
  // we need to filter out the ones that don't meet the threshold
  let filteredResults = scaledResults;
  if (
    scaledResults.some((result) => result.meetsThreshold) &&
    scaledResults.some((result) => !result.meetsThreshold)
  ) {
    filteredResults = scaledResults.filter((result) => result.meetsThreshold);
  }

  return new Response(JSON.stringify(filteredResults), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
