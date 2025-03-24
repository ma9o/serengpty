import { createMessageDispatcher } from '../factory';
import { ConversationChangedMessage, RequestContentExtractionMessage } from '../types';

export * from './handleConversationContent';
export * from './handleConversationInitialContent';
export * from './handleConversationNavigated';
export * from './handleConversationTitleUpdated';
export * from './handleGetSidepanelState';
export * from './handleOpenSidepanel';
export * from './setupMessageHandlers';
export * from './requestConversationContent';

// Export direct message dispatchers for background
export const dispatchConversationChanged = createMessageDispatcher<ConversationChangedMessage>(
  'conversationChanged', 'background', 'runtime'
);

// Export dispatcher for requesting content extraction
export const dispatchRequestContentExtraction = createMessageDispatcher<RequestContentExtractionMessage>(
  'requestContentExtraction', 'background', 'tabs'
);