import { Message } from './extractConversation';
import XXH from 'xxhashjs';

// We'll use seed 0x1337 for our hash function
const SEED = 0x1337;

/**
 * Creates a hash from a conversation to use for comparison
 * @param messages Array of messages to hash
 * @returns Hash string representing the conversation
 */
export function hashConversation(messages: Message[]): string {
  // Create a simplified representation for hashing
  const simplifiedMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
  
  // Convert to string and hash using XXH64 (64-bit version)
  const stringToHash = JSON.stringify(simplifiedMessages);
  return XXH.h64(stringToHash, SEED).toString(16);
}