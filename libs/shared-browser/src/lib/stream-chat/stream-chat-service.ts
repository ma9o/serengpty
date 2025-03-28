/**
 * Stream Chat Service
 *
 * This service handles server-side Stream Chat functionality
 * and is platform-agnostic
 */
import { StreamChat } from 'stream-chat';
import { ChatTokenResult, StreamChatConfig, StreamChatUserData } from './types';

export class StreamChatService {
  private client: StreamChat;
  private config: StreamChatConfig;

  constructor(config: StreamChatConfig) {
    this.config = config;

    if (!config.apiKey) {
      throw new Error('Stream Chat API key is required');
    }

    // Initialize client with API key only if API secret isn't provided
    if (!config.apiSecret) {
      this.client = StreamChat.getInstance(config.apiKey);
    } else {
      // Initialize server-side client with API key and secret
      this.client = StreamChat.getInstance(config.apiKey, config.apiSecret);
    }
  }

  /**
   * Generate a user token for Stream Chat client authentication
   * @param userId User ID to generate token for
   * @returns Token result object with token or error
   */
  generateToken(userId: string): ChatTokenResult {
    try {
      if (!this.config.apiSecret) {
        return {
          token: null,
          error: 'API secret is required to generate tokens',
        };
      }

      if (!userId) {
        return {
          token: null,
          error: 'User ID is required',
        };
      }

      const token = this.client.createToken(userId);
      return { token, error: null };
    } catch (error) {
      console.error('Error generating chat token:', error);
      return {
        token: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Upsert a user in Stream Chat
   * @param userData User data for Stream Chat
   * @returns Promise that resolves when user is created/updated
   */
  async upsertUser(userData: StreamChatUserData): Promise<void> {
    try {
      if (!this.config.apiSecret) {
        throw new Error('API secret is required to upsert users');
      }

      await this.client.upsertUser({
        id: userData.id,
        role: userData.role || 'user',
        name: userData.name,
        image: userData.image,
      });
    } catch (error) {
      console.error('Error upserting Stream Chat user:', error);
      throw error;
    }
  }
}
