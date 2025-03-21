import { SimilarUser } from '../utils/storage';

// Using environment variable or default to localhost during development
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Ensure the URL doesn't end with a trailing slash
function formatApiUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function signUp() {
  try {
    const response = await fetch(`${formatApiUrl(API_BASE_URL)}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Signup failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error during signup:', error);
    throw error;
  }
}

/**
 * Get a chat token for Stream Chat
 * @param userId The user ID to generate a token for
 * @returns Chat token and any error
 */
export async function getChatToken(userId: string) {
  try {
    const response = await fetch(`${formatApiUrl(API_BASE_URL)}/chat-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get chat token with status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting chat token:', error);
    return {
      token: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface UpsertConversationData {
  id: string;
  title: string;
  userId: string;
  content: string; // Stringified messages array
}

// Keep track of ongoing requests to allow cancellation
const activeRequests = new Map<string, AbortController>();

/**
 * Upsert a ChatGPT conversation with advanced request management
 * @param data The conversation data to send
 * @returns Similar users based on conversation content
 */
export async function upsertConversation(data: UpsertConversationData): Promise<SimilarUser[]> {
  try {
    // Cancel any existing request for this conversation
    if (activeRequests.has(data.id)) {
      console.log(`Cancelling existing request for conversation ${data.id}`);
      activeRequests.get(data.id)?.abort();
      activeRequests.delete(data.id);
    }
    
    // Create a new abort controller for this request
    const abortController = new AbortController();
    activeRequests.set(data.id, abortController);
    
    // Add timeout of 30 seconds
    const timeoutId = setTimeout(() => {
      if (activeRequests.has(data.id)) {
        console.log(`Request for conversation ${data.id} timed out after 30s`);
        abortController.abort();
        activeRequests.delete(data.id);
      }
    }, 30000);
    
    try {
      const response = await fetch(
        `${formatApiUrl(API_BASE_URL)}/upsert-conversation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: abortController.signal
        }
      );
  
      clearTimeout(timeoutId);
      activeRequests.delete(data.id);
  
      if (!response.ok) {
        throw new Error(
          `Failed to upsert conversation with status: ${response.status}`
        );
      }
  
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
      if (activeRequests.get(data.id) === abortController) {
        activeRequests.delete(data.id);
      }
    }
  } catch (error) {
    // Don't log or rethrow if this was a cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Request was cancelled');
      return [];
    }
    
    console.error('Error upserting conversation:', error);
    throw error;
  }
}
