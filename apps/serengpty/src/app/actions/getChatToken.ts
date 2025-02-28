'use server';

import { StreamChat } from 'stream-chat';
import { getCurrentUser } from './getCurrentUser';

// This should be moved to environment variables
const API_KEY = process.env.STREAM_CHAT_API_KEY;
const API_SECRET = process.env.STREAM_CHAT_API_SECRET;

export async function getChatToken(): Promise<{token: string} | {error: string}> {
  try {
    // Get current user from session
    const user = await getCurrentUser();

    if (!user?.id) {
      return { error: 'User not authenticated' };
    }

    if (!API_KEY || !API_SECRET) {
      console.error('Stream Chat API credentials not configured');
      return { error: 'Chat service not configured' };
    }

    // Initialize Chat client
    const serverClient = StreamChat.getInstance(API_KEY, API_SECRET);

    // Generate token with server-side client
    const token = serverClient.createToken(user.id);

    return { token };
  } catch (error) {
    console.error('Error generating chat token:', error);
    return { error: 'Failed to generate chat token' };
  }
}