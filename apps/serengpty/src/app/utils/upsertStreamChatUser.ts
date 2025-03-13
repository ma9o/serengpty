import { StreamChat } from 'stream-chat';
import { User } from '@prisma/client';

export async function upsertStreamChatUser(user: User) {
  return await StreamChat.getInstance(
    process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
    process.env.STREAM_CHAT_API_SECRET!
  ).upsertUser({
    id: user.id,
    role: 'user',
    username: user.name,
    name: user.name,
  });
}
