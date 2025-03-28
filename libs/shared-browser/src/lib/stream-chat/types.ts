/**
 * Stream Chat shared types
 * 
 * This file contains type definitions for the Stream Chat integration
 * that are shared across the application and extension.
 */

/**
 * StreamChatUserData represents the minimal user data needed for Stream Chat
 */
export interface StreamChatUserData {
  id: string;
  name: string;
  role?: 'user' | 'admin';
  image?: string;
}

/**
 * StreamChatConfig contains the configuration needed for Stream Chat
 */
export interface StreamChatConfig {
  apiKey: string;
  apiSecret?: string;
}

/**
 * Result interface for Stream Chat token generation
 */
export interface ChatTokenResult {
  token: string | null;
  error: string | null;
}

/**
 * Channel creation parameters
 */
export interface CreateChannelParams {
  members: string[];
  createdById: string;
  name?: string;
  initialMessage?: string;
}

/**
 * Chat notification event data that can be used by the UI layer
 */
export interface ChatNotificationEvent {
  totalUnreadCount?: number;
  channelId?: string;
  messageText?: string;
  senderId?: string;
  senderName?: string;
}