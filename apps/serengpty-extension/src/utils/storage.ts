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
}

export interface ConversationState {
  id: string;
  status: 'idle' | 'processing' | 'completed';
  lastProcessed: string | null; // ISO timestamp
  contentHash: string | null; // Hash of messages for content comparison
  similarUsers?: SimilarUser[]; // Cache similar users
}

export const conversationStatesStorage = storage.defineItem<
  Record<string, ConversationState>
>('local:conversationStates', { fallback: {} });

export async function updateConversationState(
  conversationId: string,
  updates: Partial<ConversationState>
): Promise<ConversationState> {
  const states = await conversationStatesStorage.getValue();
  const currentState = states[conversationId] || {
    id: conversationId,
    status: 'idle',
    lastProcessed: null,
    contentHash: null,
  };

  const updatedState = { ...currentState, ...updates };
  await conversationStatesStorage.setValue({
    ...states,
    [conversationId]: updatedState,
  });

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
  conversationId: string
): Promise<boolean> {
  const states = await conversationStatesStorage.getValue();
  const state = states[conversationId];

  if (!state) return true;
  if (state.status === 'processing') return false;

  return true;
}
