import { Conversation, SerendipitousPath, User } from '@prisma/client';

export interface SerendipitousPathsResponse {
  path: SerendipitousPath;
  connectedUser: {
    id: string;
    name: string;
    image: string | null;
    country: string;
    email: string | null;
    username?: string; // Added for backward compatibility
  };
  commonConversations: Conversation[];
  currentUserUniqueConversations: Conversation[];
  connectedUserUniqueConversations: Conversation[];
}