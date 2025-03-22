# Serengpty Extension Messaging Architecture

This folder contains the new messaging architecture for the Serengpty extension, designed to make message flow more explicit and easier to trace.

## Directory Structure

```
messaging/
  types.ts                 # Shared message type definitions
  content/                 # Content script messaging
    dispatch*.ts           # Functions to dispatch messages from content
    index.ts               # Exported API
  background/              # Background script messaging
    dispatch*.ts           # Functions to dispatch messages from background
    handle*.ts             # Functions to handle incoming messages to background
    index.ts               # Exported API
  sidepanel/               # Sidepanel messaging
    dispatch*.ts           # Functions to dispatch messages from sidepanel
    handle*.ts             # Functions to handle incoming messages to sidepanel
    index.ts               # Exported API
```

## Message Flow

### 1. Content Script → Background Script

Content script dispatches messages to the background script:
- `dispatchConversationContent`: When conversation content changes
- `dispatchConversationInitialContent`: When first loading a conversation
- `dispatchConversationNavigated`: When navigating to a different conversation
- `dispatchOpenSidepanel`: When the user clicks to open the sidepanel

### 2. Background Script Processing

Background script processes messages:
- `handleConversationContent`: Updates storage and forwards to sidepanel
- `handleConversationInitialContent`: Updates storage and forwards to sidepanel
- `handleConversationNavigated`: Forwards to sidepanel
- `handleOpenSidepanel`: Opens the sidepanel

### 3. Background Script → Sidepanel

Background script dispatches messages to the sidepanel:
- `dispatchConversationChanged`: When conversation content or navigation changes

### 4. Sidepanel

Sidepanel processes messages:
- `setupConversationChangedHandler`: Sets up handler for conversation changes
- `dispatchCloseSidepanel`: For closing the sidepanel

## Key Bug Fixes

The new architecture fixes the `useExtractMessages` bug by:

1. Ensuring message extraction ONLY happens in the content script
2. Making sure the sidepanel ONLY receives and displays messages from the background
3. Using typed messages to enforce proper data flow

## Usage Examples

### Content Script
```typescript
import { dispatchConversationNavigated } from '../utils/messaging/content';

// Send a navigation event
dispatchConversationNavigated('conversation123');
```

### Background Script
```typescript
import { setupMessageHandlers } from '../utils/messaging/background';

// Set up all message handlers
const cleanup = setupMessageHandlers();
```

### Sidepanel
```typescript
import { setupConversationChangedHandler } from '../utils/messaging/sidepanel';

// Set up handler for conversation changes
useEffect(() => {
  const cleanup = setupConversationChangedHandler((message) => {
    // Handle conversation changes
    console.log('Conversation changed:', message.conversationId);
  });
  
  return cleanup;
}, []);
```