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

export const activatedConversationsStorage = storage.defineItem<string[]>(
  'local:activatedConversations',
  { fallback: [] }
);

export async function addActivatedConversation(conversationId: string) {
  const activatedConversations = await activatedConversationsStorage.getValue();

  if (activatedConversations.includes(conversationId)) {
    console.log('Conversation already activated:', conversationId);
    return;
  }

  await activatedConversationsStorage.setValue([
    ...activatedConversations,
    conversationId,
  ]);
}

export async function isActivatedConversation(conversationId: string) {
  const activatedConversations = await activatedConversationsStorage.getValue();

  return activatedConversations.includes(conversationId);
}
