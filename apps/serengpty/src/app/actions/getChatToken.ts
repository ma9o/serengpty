'use server';

import { StreamChat } from 'stream-chat';
import { getCurrentUser } from './getCurrentUser';
import { env } from '../constants/environment';

export async function getChatToken(): Promise<{
  token: string | null;
  error: string | null;
}> {
  try {
    // Get current user from session
    const user = await getCurrentUser();

    if (!user?.id) {
      return { token: null, error: 'User not authenticated' };
    }

    if (!env.NEXT_PUBLIC_STREAM_CHAT_API_KEY || !env.STREAM_CHAT_API_SECRET) {
      console.error('Stream Chat API credentials not configured');
      return { token: null, error: 'Chat service not configured' };
    }

    // Initialize Chat client
    const serverClient = StreamChat.getInstance(
      env.NEXT_PUBLIC_STREAM_CHAT_API_KEY,
      env.STREAM_CHAT_API_SECRET
    );

    // Generate token with server-side client
    const token = serverClient.createToken(user.id);

    return { token: token, error: null };
  } catch (error) {
    console.error('Error generating chat token:', error);
    return { token: null, error: 'Failed to generate chat token' };
  }
}
