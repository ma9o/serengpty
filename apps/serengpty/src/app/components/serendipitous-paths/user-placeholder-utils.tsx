/**
 * Utility function to replace <USER_1>, <USER_2>, and <USER> placeholders with actual usernames
 * @param text The text containing placeholders
 * @param currentUserName Name of the current user
 * @param otherUserName Name of the other user
 * @param currentUserPath The path data for the current user
 * @param matchedUserPath The path data for the matched user
 * @param isCurrentUserContext Optional flag to indicate if we're in current user's context
 * @returns The text with placeholders replaced with proper usernames
 */
export function replaceUserPlaceholders(
  text: string,
  currentUserName: string,
  otherUserName: string,
  currentUserPath: {
    uniqueSummary: string;
    user: { id: string; name: string };
  },
  matchedUserPath: {
    uniqueSummary: string;
    user: { id: string; name: string };
  },
  isCurrentUserContext?: boolean
): string {
  // Determine which user is USER_1 and which is USER_2 by checking the uniqueSummary field
  let user1Name: string;
  let user2Name: string;

  // If the current user's path contains <USER_1>, then the current user is USER_1
  if (currentUserPath.uniqueSummary.includes('<USER_1>')) {
    user1Name = currentUserName;
    user2Name = otherUserName;
  } else if (currentUserPath.uniqueSummary.includes('<USER_2>')) {
    user1Name = otherUserName;
    user2Name = currentUserName;
  } else {
    // If we can't determine from the current user's path, check the matched user's path
    if (matchedUserPath.uniqueSummary.includes('<USER_1>')) {
      user1Name = otherUserName;
      user2Name = currentUserName;
    } else {
      // Default fallback if we can't determine from either path
      user1Name = currentUserName;
      user2Name = otherUserName;
    }
  }

  // Replace placeholders with actual names
  let processed = text
    .replace(/<USER_1>/g, user1Name)
    .replace(/<USER_2>/g, user2Name);

  // Replace generic <USER> placeholder based on context
  if (typeof isCurrentUserContext !== 'undefined') {
    // If we know the context, replace with the appropriate name
    processed = processed.replace(
      /<USER>/g,
      isCurrentUserContext ? currentUserName : otherUserName
    );
  } else {
    // If we don't know the context, replace based on the conversation context
    // If it's in "Your Perspective" or "Your Unique Conversations", use current user
    // Otherwise, use the conversation user if available
    processed = processed.replace(/<USER>/g, currentUserName);
  }

  return processed;
}