import { streamText } from 'ai';
import { db, conversationsTable, usersTable } from '@enclaveid/db';
import { eq, and } from 'drizzle-orm';
import { azureAi } from '../../services/azureAi';

export async function POST(req: Request) {
  const { apiKey, currentConversationId, otherConversationId } =
    await req.json();

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.extensionApiKey, apiKey),
  });

  if (!user) {
    return new Response('User not found', { status: 404 });
  }

  // Find conversation owned by the user
  const currentConversationContents =
    await db.query.conversationsTable.findFirst({
      where: and(
        eq(conversationsTable.id, currentConversationId),
        eq(conversationsTable.userId, user.id)
      ),
    });

  if (!currentConversationContents) {
    return new Response('Current conversation not found or not owned by user', {
      status: 404,
    });
  }

  const otherConversationContents = await db.query.conversationsTable.findFirst(
    {
      where: eq(conversationsTable.id, otherConversationId),
    }
  );

  const prompt = `
  I will give you two ChatGPT conversations.
  What's the main commonality and divergences between the two conversations?
  Stay around 50 words, don't be too formal.

  Use markdown to format your response as follows:
  **Commonalities**
  You both [...].
  **Divergences**
  Your focus is [...], while theirs is [...].

  My Conversation:
  ${currentConversationContents?.content}

  Their Conversation:
  ${otherConversationContents?.content}
  `;

  const result = streamText({
    model: azureAi('gpt-4o-mini'),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return result.toDataStreamResponse();
}
