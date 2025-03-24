import { Message } from '../content/extractConversation';

// Common message interface with discriminated union
export interface BaseMessage {
  action: string;
}

// Content -> Background Messages
export interface ConversationContentMessage extends BaseMessage {
  action: 'conversationContent';
  conversationId: string;
  messages: Message[];
  contentHash: string;
}

export interface ConversationInitialContentMessage extends BaseMessage {
  action: 'conversationInitialContent';
  conversationId: string;
  messages: Message[];
  contentHash: string;
}

export interface ConversationNavigatedMessage extends BaseMessage {
  action: 'conversationNavigated';
  conversationId: string;
  title?: string;
}

export interface ConversationTitleUpdatedMessage extends BaseMessage {
  action: 'conversationTitleUpdated';
  conversationId: string;
  title: string;
}

// Content -> Background or Background -> Content Messages
export interface OpenSidepanelMessage extends BaseMessage {
  action: 'openSidepanel';
}

export interface CloseSidepanelMessage extends BaseMessage {
  action: 'closeSidePanel';
}

export interface GetSidepanelStateMessage extends BaseMessage {
  action: 'getSidepanelState';
}

// Background -> Content Messages
export interface RequestContentExtractionMessage extends BaseMessage {
  action: 'requestContentExtraction';
  conversationId: string;
  source: 'background';
}

// Background -> Sidepanel Messages
export interface ConversationChangedMessage extends BaseMessage {
  action: 'conversationChanged';
  conversationId: string;
  messages?: Message[];
  contentHash?: string;
  title?: string;
}

// Union type of all messages
export type ExtensionMessage = 
  | ConversationContentMessage
  | ConversationInitialContentMessage
  | ConversationNavigatedMessage
  | ConversationTitleUpdatedMessage
  | OpenSidepanelMessage
  | CloseSidepanelMessage
  | GetSidepanelStateMessage
  | RequestContentExtractionMessage
  | ConversationChangedMessage;