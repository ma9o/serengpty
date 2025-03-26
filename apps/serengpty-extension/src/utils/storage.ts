export interface UserData {
  userId: string;
  name: string;
}

export const userDataStorage = storage.defineItem<UserData>('local:userData');

export interface UserPreferences {
  doNotAskAgain: boolean;
}

export const userPreferencesStorage = storage.defineItem<UserPreferences>(
  'local:userPreferences',
  { fallback: { doNotAskAgain: false } }
);

export interface SimilarUser {
  userId: string;
  userName: string;
  id: string;
  title: string;
  distance: number;
  createdAt: string;
  meetsThreshold: boolean; // Add flag indicating if meets threshold
}

export interface ConversationState {
  id: string;
  // Add 'error' to the status possibilities
  status: 'idle' | 'processing' | 'completed' | 'error';
  lastProcessed: string | null; // ISO timestamp
  contentHash: string | null; // Hash of messages for content comparison
  similarUsers?: SimilarUser[]; // Cache similar users
  // Add an optional error message field
  error?: string | null;
}

export const conversationStatesStorage = storage.defineItem<
  Record<string, ConversationState>
>('local:conversationStates', { fallback: {} });

export async function updateConversationState(
  conversationId: string,
  updates: Partial<Omit<ConversationState, 'id'>> // Use Omit to prevent overwriting ID
): Promise<ConversationState> {
  const states = await conversationStatesStorage.getValue();
  const currentState = states[conversationId] || {
    id: conversationId,
    status: 'idle',
    lastProcessed: null,
    contentHash: null,
    error: null, // Initialize error field
  };

  // Ensure we don't accidentally remove existing fields if not provided in updates
  const updatedState: ConversationState = {
    ...currentState,
    ...updates,
  };

  await conversationStatesStorage.setValue({
    ...states,
    [conversationId]: updatedState,
  });

  // Log the state update for debugging
  console.log(`[Storage] Updated state for ${conversationId}:`, updatedState);

  return updatedState;
}

// Replacement for isActivatedConversation - now checks if conversation exists in the state store
export async function isActivatedConversation(
  conversationId: string
): Promise<boolean> {
  const states = await conversationStatesStorage.getValue();
  if (states[conversationId]) return true;

  return false;
}

// Replacement for addActivatedConversation - now initializes a conversation state
export async function addActivatedConversation(
  conversationId: string
): Promise<void> {
  const states = await conversationStatesStorage.getValue();
  if (!states[conversationId]) {
    await updateConversationState(conversationId, {
      status: 'idle',
      lastProcessed: null,
      contentHash: null,
    });
  }
}

export async function shouldProcessConversation(
  conversationId: string,
  currentContentHash: string | null // Add current hash to check against
): Promise<boolean> {
  const states = await conversationStatesStorage.getValue();
  const state = states[conversationId];

  if (!state) return true; // Never processed before

  // Don't process if currently processing
  if (state.status === 'processing') return false;

  // Don't process if the last attempt for THIS hash resulted in an error
  if (state.status === 'error' && state.contentHash === currentContentHash) {
      console.log(`[Storage] Skipping processing for ${conversationId} - hash ${currentContentHash} previously failed.`);
      return false;
  }

  // Don't process if the content hash is the same as the last successfully completed one
  if (state.status === 'completed' && state.contentHash === currentContentHash) {
      console.log(`[Storage] Skipping processing for ${conversationId} - hash ${currentContentHash} already completed.`);
      return false;
  }

  // Otherwise, okay to process (idle, or completed but hash changed, or error but hash changed)
  return true;
}
