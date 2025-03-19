import { db } from '../../services/db';
import { eq } from 'drizzle-orm';
import { usersTable, conversationsTable } from '../../services/db/schema';

export async function POST(request: Request) {
  const { apiToken, title, content } = await request.json();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.apiToken, apiToken),
  });

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const embedding = await generateEmbedding(content);

  const conversation = await db.insert(conversationsTable).values({
    title,
    content,
    userId: user.id,
  });

  return new Response('Conversation created', { status: 201 });
}
