import { StreamChatService, StreamChatUserData } from '@enclaveid/shared-utils';
import { User } from '@prisma/client';
import { env } from '../constants/environment';

/**
 * Upsert a user in Stream Chat using the shared service
 * @param user Prisma User object
 * @returns Promise resolving when the user is created/updated
 */
export async function upsertStreamChatUser(user: User) {
  // Create Stream Chat service with server credentials
  const streamChatService = new StreamChatService({
    apiKey: env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
    apiSecret: env.STREAM_CHAT_API_SECRET
  });

  // Map Prisma User to StreamChatUserData
  const chatUserData: StreamChatUserData = {
    id: user.id,
    name: user.name,
    role: 'user',
    // Can add image if needed
  };

  // Use the shared service to upsert the user
  return await streamChatService.upsertUser(chatUserData);
}
