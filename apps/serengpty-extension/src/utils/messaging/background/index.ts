import { createMessageDispatcher } from '../factory';
import { ConversationChangedMessage } from '../types';

export * from './handleConversationContent';
export * from './handleConversationInitialContent';
export * from './handleConversationNavigated';
export * from './handleConversationTitleUpdated';
export * from './handleGetSidepanelState';
export * from './handleOpenSidepanel';
export * from './setupMessageHandlers';

// Export direct message dispatchers for background
export const dispatchConversationChanged = createMessageDispatcher<ConversationChangedMessage>(
  'conversationChanged', 'background', 'runtime'
);