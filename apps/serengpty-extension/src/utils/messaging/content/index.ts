import { createMessageDispatcher } from '../factory';
import { 
  ConversationContentMessage, 
  ConversationInitialContentMessage,
  ConversationNavigatedMessage,
  ConversationTitleUpdatedMessage,
  OpenSidepanelMessage
} from '../types';

// Export handlers
export * from './handleRequestContentExtraction';
export * from './setupMessageHandlers';

// Export direct message dispatchers
export const dispatchConversationContent = createMessageDispatcher<ConversationContentMessage>(
  'conversationContent', 'content', 'runtime'
);

export const dispatchConversationInitialContent = createMessageDispatcher<ConversationInitialContentMessage>(
  'conversationInitialContent', 'content', 'runtime'
);

export const dispatchConversationNavigated = createMessageDispatcher<ConversationNavigatedMessage>(
  'conversationNavigated', 'content', 'runtime'
);

export const dispatchConversationTitleUpdated = createMessageDispatcher<ConversationTitleUpdatedMessage>(
  'conversationTitleUpdated', 'content', 'runtime'
);

export const dispatchOpenSidepanel = createMessageDispatcher<OpenSidepanelMessage>(
  'openSidepanel', 'content', 'runtime'
);