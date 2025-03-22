/**
 * Extracts the conversation ID from a ChatGPT URL
 * @param url - The ChatGPT URL to extract the conversation ID from
 * @returns The conversation ID or null if not found
 */
export function extractConversationId(url: string | URL): string | null {
  // Handle both string and URL object types
  const urlString = url instanceof URL ? url.toString() : url;

  // Check if the URL matches the pattern for a conversation page
  if (!urlString.includes('chatgpt.com/c/')) {
    return null;
  }

  // Extract the ID using regex for more robustness
  const match = urlString.match(/chatgpt\.com\/c\/([a-zA-Z0-9_-]+)/);

  // If we have a match, return the first capture group
  if (match && match[1]) {
    return match[1];
  }

  return null;
}
