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

/**
 * Upsert a ChatGPT conversation
 * @param conversationData The conversation data to send
 * @returns Response data
 */
export async function upsertConversation(conversationData: {
  id: string;
  title: string;
  userId: string;
}) {
  try {
    const response = await fetch(
      `${formatApiUrl(API_BASE_URL)}/upsert-conversation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationData),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to upsert conversation with status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('Error upserting conversation:', error);
    throw error;
  }
}
