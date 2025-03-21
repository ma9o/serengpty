'use server';

import { StreamChatService, ChatTokenResult } from '@enclaveid/shared-utils';
import { getCurrentUser } from './getCurrentUser';
import { env } from '../constants/environment';

export async function getChatToken(): Promise<ChatTokenResult> {
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

    // Use the shared service to generate token
    const streamChatService = new StreamChatService({
      apiKey: env.NEXT_PUBLIC_STREAM_CHAT_API_KEY,
      apiSecret: env.STREAM_CHAT_API_SECRET
    });

    // Generate token with server-side client
    return streamChatService.generateToken(user.id);
  } catch (error) {
    console.error('Error generating chat token:', error);
    return { 
      token: null, 
      error: error instanceof Error ? error.message : 'Failed to generate chat token'
    };
  }
}
