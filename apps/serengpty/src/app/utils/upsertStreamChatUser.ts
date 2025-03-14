import { StreamChat } from 'stream-chat';
import { User } from '@prisma/client';
import { env } from '../constants/environment';

export async function upsertStreamChatUser(user: User) {
  return await StreamChat.getInstance(
    env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
    env.STREAM_CHAT_API_SECRET
  ).upsertUser({
    id: user.id,
    role: 'user',
    username: user.name,
    name: user.name,
  });
}
