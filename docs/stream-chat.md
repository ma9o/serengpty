# Stream Chat Implementation

This document details how [Stream Chat](https://getstream.io/chat/) is implemented in the Serengpty application, covering architecture, authentication, UI components, and integration patterns.

## Architecture Overview

The Stream Chat implementation follows a clean architecture with:

1. **Client-side Components**: React components that handle UI rendering and user interactions
2. **Server-side Functions**: Next.js server actions for secure authentication and token generation
3. **Context Providers**: React context for state management across components
4. **Service Layer**: Singleton pattern for client initialization and management

## Configuration and Environment Setup

### Required Environment Variables

- `NEXT_PUBLIC_STREAM_CHAT_API_KEY`: Public API key for client-side initialization
- `STREAM_CHAT_API_SECRET`: Secret key for server-side token generation (never exposed to client)

### Client Initialization

Stream Chat client uses a singleton pattern implemented in `services/streamChat.ts`:

```typescript
// Singleton pattern ensures only one instance of the Stream Chat client exists
export const getStreamChatClient = () => {
  if (!instance) {
    instance = StreamChat.getInstance(process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!);
  }
  return instance;
};
```

## Authentication Flow

1. **User Registration**:
   - New users are automatically registered with Stream Chat during signup
   - User ID in Stream Chat matches the application's user ID for consistency

2. **Token Generation**:
   - Secure token generation happens server-side in `actions/getChatToken.ts`
   - Uses Next.js server actions for secure execution with access to environment variables
   - Includes fallback to development tokens for testing environments

3. **Authentication Context**:
   - `StreamChatUserContext.tsx` provides authentication state to components
   - Manages user ID and token availability throughout the application

## Component Structure

### Core Components

1. **StreamChatUserContext** (`components/chat/StreamChatUserContext.tsx`):
   - Manages authentication state for Stream Chat
   - Provides user ID and token to child components
   - Handles loading and error states

2. **ChatProvider** (`components/chat/ChatProvider.tsx`):
   - Wraps Stream Chat's provider component
   - Initializes the client with user credentials
   - Sets up theme and custom styling

3. **ChatInterface** (`components/chat/ChatInterface.tsx`):
   - Main UI component for the chat experience
   - Integrates ChannelList, Channel, MessageList, and MessageInput components
   - Handles responsive layout for different screen sizes

4. **ChatButton** (`components/chat/ChatButton.tsx`):
   - UI component to initiate new conversations
   - Handles channel creation logic

5. **Custom Components**:
   - Custom avatar component using identicons 
   - Styled with application theme using Tailwind CSS

## Usage Patterns

### Direct Messaging

The implementation primarily focuses on direct messaging between users:

1. **Channel Creation**:
   - Channels are created for direct messaging in `useStartChat.ts`
   - Uses a consistent naming convention for channel IDs
   - Implements logic to prevent duplicate channels

2. **User Discovery**:
   - Integrates with the application's user system to find chat partners
   - Shows online status and user metadata

### Notification System

Stream Chat notifications are integrated into the application:

1. **Setup**:
   - Event listeners for notifications in `ChatProvider.tsx`
   - Updates unread message counts in UI components

2. **Implementation**:
   - Global notification counter in navigation
   - In-app notifications for new messages
   - Browser notifications (when permitted)

## Error Handling

Comprehensive error handling throughout:

1. **Authentication Errors**:
   - Fallback mechanisms for token retrieval failures
   - Automatic reconnection attempts

2. **API Errors**:
   - Proper error handling for Stream API calls
   - User-friendly error messages

3. **Component Error Boundaries**:
   - Prevents entire UI from crashing if chat components fail

## Security Considerations

1. **Token Generation**:
   - Server-side only, using secure server actions
   - Short expiration times with automatic renewal

2. **User Permissions**:
   - Proper channel permission settings
   - Limited visibility of users and channels

3. **Data Handling**:
   - No sensitive data stored in local storage
   - Proper cleanup on logout

## Future Improvements

Potential enhancements to the current implementation:

1. **Group Messaging**: Extend beyond direct messaging to support group conversations
2. **Advanced Features**: Implement reactions, threads, and typing indicators
3. **Offline Support**: Add better offline capabilities and message queueing
4. **Custom Message Types**: Support for rich content and custom message formats
5. **Analytics**: Integration with analytics tools to track engagement

## Related Code Files

- `src/app/components/chat/StreamChatUserContext.tsx`: Authentication context
- `src/app/components/chat/ChatProvider.tsx`: Stream Chat provider component
- `src/app/components/chat/ChatInterface.tsx`: Main UI component
- `src/app/components/chat/ChatButton.tsx`: Interface for starting new chats
- `src/app/components/chat/useStartChat.ts`: Hook for channel creation
- `src/app/actions/getChatToken.ts`: Server action for token generation
- `src/app/services/streamChat.ts`: Stream Chat client singleton and utilities
