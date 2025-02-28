import { User } from '@prisma/client';

// Custom interfaces to match the transformed data in getSerendipitousPaths
export interface ConversationSummary {
  id: string;
  summary: string;
  datetime: Date;
}

export interface PathSummary {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  summary: string; // Mapped from commonSummary
  score: number;
}

export interface SerendipitousPathsResponse {
  path: PathSummary;
  connectedUser: {
    id: string;
    name: string;
    image: string | null;
    country: string;
    email: string | null;
    username?: string; // Added for backward compatibility
  };
  commonConversations: ConversationSummary[];
  currentUserUniqueConversations: ConversationSummary[];
  connectedUserUniqueConversations: ConversationSummary[];
  
  // New fields for multiple paths
  averageUserScore: number; // Average score across all paths with this user
  totalUserPaths: number; // Total number of paths with this user
}