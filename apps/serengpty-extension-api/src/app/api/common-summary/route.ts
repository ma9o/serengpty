import { streamText } from 'ai';
import { db } from '../../services/db';
import { eq } from 'drizzle-orm';
import { conversationsTable } from '../../services/db/schema';
import { azureAi } from '../../services/azureAi';

export async function POST(req: Request) {
  const { currentConversationId, otherConversationId } = await req.json();

  const currentConversationContents =
    await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.id, currentConversationId),
    });

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
