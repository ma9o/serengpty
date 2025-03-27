import { StreamChatUserData } from '@enclaveid/shared-utils';
import { usersTable } from '@enclaveid/db';
import { getStreamChatService } from '../services/streamChat';

/**
 * Upsert a user in Stream Chat using the shared service
 * @param user User object
 * @returns Promise resolving when the user is created/updated
 */
export async function upsertStreamChatUser(
  user: typeof usersTable.$inferSelect
) {
  // Map User to StreamChatUserData
  const chatUserData: StreamChatUserData = {
    id: user.id,
    name: user.name,
    role: 'user',
    // Can add image if needed
  };

  // Use the shared service to upsert the user
  return await getStreamChatService().then((service) =>
    service.upsertUser(chatUserData)
  );
}
