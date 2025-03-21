# SimilarUsersTab Implementation Plan

## Overview

The SimilarUsersTab functionality will extract conversation content from the ChatGPT interface and send it to the backend to find similar conversations and users to engage with. This implementation plan covers:

1. Content extraction from ChatGPT conversations
2. Improved state management for active conversations
3. API integration for upsert-conversation requests
4. Component implementation for displaying similar users

### Key Design Decisions

**Smart Conversation Processing**: We'll process conversations only when a new complete user+assistant message pair is available, not on every DOM change. This optimizes API usage while ensuring users see the most relevant similar conversations.

**Complete Conversation Approach**: While we could track and send only new messages, we'll send the entire conversation each time to ensure consistency. This simplifies the implementation while our detection mechanism ensures we only send when necessary.

**Robust State Management**: Instead of the simple list of activated conversations, we'll use a richer state model that tracks processing status, content hashes, and caches results. This prevents redundant processing and improves the user experience.

**Request Management**: To handle potential race conditions when rapid conversation changes occur, we've implemented request cancellation. This ensures only the most recent request completes, preventing stale data from overwriting newer results.

## Implementation Details

### 1. Conversation Content Extraction (Hook Implementation)

Create a hook that extracts conversation messages from ChatGPT's DOM and manages conversation updates. This hook is responsible for:

1. Extracting the conversation content from the DOM
2. Monitoring for changes to detect new message pairs
3. Intelligently deciding when to trigger processing
4. Managing the extraction state to prevent concurrent processing

The hook approach (vs. a simple function) allows us to maintain state across DOM updates, intelligently detect when a meaningful change has occurred, and only trigger processing when a complete user+assistant message pair is available.

**Location**: `/apps/serengpty-extension/src/hooks/useExtractConversation.ts`

```typescript
import { useEffect, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export function useExtractConversation(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    
    // Function to extract conversation from DOM
    const extractMessages = (): Message[] => {
      console.log('Extracting conversation content from DOM');
      
      try {
        // Get the first main element that contains the chat
        const mainElement = document.querySelector('main');
        if (!mainElement) return [];
        
        // Get all article elements (each represents a message)
        const articleElements = mainElement.querySelectorAll('article');
        if (!articleElements || articleElements.length === 0) return [];
        
        const messages: Message[] = [];
        
        // Process each article
        articleElements.forEach((article) => {
          try {
            let role: 'user' | 'assistant' = 'user'; // Default role
            let content = '';
            
            // Try to identify role from heading first
            const heading = article.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
              const headingText = heading.textContent || '';
              if (headingText.includes('ChatGPT') || headingText.includes('Assistant') || headingText.includes('Claude')) {
                role = 'assistant';
              } else if (headingText.includes('You')) {
                role = 'user';
              }
            }
            
            if (role === 'user') {
              // For user messages: find the first div with only whitespace-pre-wrap class
              const userContentDiv = Array.from(article.querySelectorAll('div')).find(div => {
                const classList = div.classList;
                return classList.length === 1 && classList.contains('whitespace-pre-wrap');
              });
              
              if (userContentDiv) {
                content = userContentDiv.textContent || '';
              }
            } else {
              // For assistant messages: get text from content area
              // First try to find the main content div after the heading
              const assistantContentArea = heading ? 
                heading.nextElementSibling : 
                article.querySelector('div.markdown');
                
              if (assistantContentArea) {
                // Get all text content, excluding UI elements
                const uiElements = assistantContentArea.querySelectorAll('button, svg');
                const clonedContent = assistantContentArea.cloneNode(true) as HTMLElement;
                
                // Remove UI elements from the clone
                uiElements.forEach(el => {
                  const match = clonedContent.querySelector(`#${el.id}`);
                  if (match) match.remove();
                });
                
                content = clonedContent.textContent || '';
              }
            }
            
            // Only add message if we have content
            if (content.trim()) {
              messages.push({
                role,
                content: content.trim(),
                timestamp: new Date().toISOString()
              });
            }
          } catch (articleError) {
            console.error('Error processing article:', articleError);
            // Continue to next article even if this one fails
          }
        });
        
        return messages;
      } catch (error) {
        console.error('Error extracting conversation:', error);
        return [];
      }
    };
    
    // Track previous message count to detect new messages
    let previousMessageCount = 0;
    
    // We'll observe DOM changes to detect conversation updates
    const observer = new MutationObserver((mutations) => {
      // Only process if we're not already processing
      if (isProcessing) return;
      
      // Extract current messages to check if there's anything new
      const currentMessages = extractMessages();
      
      // Only trigger processing if:
      // 1. We have more messages than before (new message added)
      // 2. The last message is from the assistant (a complete user+assistant pair)
      // 3. We haven't processed in the last 5 minutes (throttling)
      const hasNewMessages = currentMessages.length > previousMessageCount;
      const lastMessageIsAssistant = currentMessages.length > 0 && 
                                    currentMessages[currentMessages.length - 1].role === 'assistant';
      
      const timeThresholdMet = !lastProcessedAt || 
                              (new Date().getTime() - lastProcessedAt.getTime() > 5 * 60 * 1000);
      
      if (hasNewMessages && lastMessageIsAssistant && (timeThresholdMet || previousMessageCount === 0)) {
        console.log('Processing new conversation content');
        setIsProcessing(true);
        setMessages(currentMessages);
        setLastProcessedAt(new Date());
        previousMessageCount = currentMessages.length;
        setIsProcessing(false);
      } else {
        // Update the previous count even if we don't process
        previousMessageCount = currentMessages.length;
      }
    });
    
    // Start observing the main element that contains the conversation
    const conversationContainer = document.querySelector('main');
    if (conversationContainer) {
      observer.observe(conversationContainer, { childList: true, subtree: true });
    }
    
    // Initial extraction
    const initialMessages = extractMessages();
    previousMessageCount = initialMessages.length;
    
    // Only set messages if we have at least one complete user+assistant pair
    if (initialMessages.length >= 2) {
      // Check if the last message is from the assistant (complete pair)
      const lastMessageIsAssistant = initialMessages[initialMessages.length - 1].role === 'assistant';
      if (lastMessageIsAssistant) {
        setMessages(initialMessages);
        setLastProcessedAt(new Date());
      }
    }
    
    return () => {
      observer.disconnect();
    };
  }, [conversationId, isProcessing, lastProcessedAt]);
  
  return { messages, isProcessing };
}
```

### 2. Improved Conversation State Management

Enhance the storage utility to better manage active conversations and prevent excessive API requests. We're replacing the simple `activatedConversations` array with a more robust state management system that tracks the full lifecycle of conversation processing.

**Why This Approach**: The previous implementation only tracked which conversations had been activated, with no additional metadata. Our enhanced approach allows us to:
- Track the processing status to prevent concurrent requests
- Compare conversation content to avoid reprocessing identical content
- Cache similar users to improve performance
- Implement proper throttling based on processing timestamps

**Location**: `/apps/serengpty-extension/src/utils/storage.ts`

Add the following functionality:
- Track conversation processing status (idle, processing, completed)
- Store the content hash to detect actual changes vs. DOM refresh
- Add timestamp to track when conversations were last processed
- Cache similar users to avoid unnecessary API calls

```typescript
export interface ConversationState {
  id: string;
  status: 'idle' | 'processing' | 'completed';
  lastProcessed: string | null; // ISO timestamp
  lastContent: string | null; // Stringified messages for content comparison
  similarUsers?: SimilarUser[]; // Cache similar users
}

export interface SimilarUser {
  userId: string;
  userName: string;
  conversationId: string;
  title: string;
  distance: number;
  createdAt: string;
}

export const conversationStatesStorage = storage.defineItem<Record<string, ConversationState>>(
  'local:conversationStates',
  { fallback: {} }
);

// Replacing activatedConversationsStorage with conversationStatesStorage
// The old activatedConversationsStorage was just a list of IDs with no additional metadata
// Now we store rich state information about each conversation

export async function updateConversationState(
  conversationId: string, 
  updates: Partial<ConversationState>
): Promise<ConversationState> {
  const states = await conversationStatesStorage.getValue();
  const currentState = states[conversationId] || {
    id: conversationId,
    status: 'idle',
    lastProcessed: null,
    lastContent: null
  };
  
  const updatedState = { ...currentState, ...updates };
  await conversationStatesStorage.setValue({
    ...states,
    [conversationId]: updatedState
  });
  
  return updatedState;
}

// Replacement for isActivatedConversation - now checks if conversation exists in the state store
export async function isActivatedConversation(conversationId: string): Promise<boolean> {
  const states = await conversationStatesStorage.getValue();
  return !!states[conversationId];
}

// Replacement for addActivatedConversation - now initializes a conversation state
export async function addActivatedConversation(conversationId: string): Promise<void> {
  const states = await conversationStatesStorage.getValue();
  if (!states[conversationId]) {
    await updateConversationState(conversationId, {
      status: 'idle',
      lastProcessed: null,
      lastContent: null
    });
  }
}

export async function shouldProcessConversation(conversationId: string): Promise<boolean> {
  const states = await conversationStatesStorage.getValue();
  const state = states[conversationId];
  
  if (!state) return true;
  if (state.status === 'processing') return false;
  
  // Don't process again if it was processed in the last 5 minutes
  if (state.lastProcessed) {
    const lastProcessedTime = new Date(state.lastProcessed).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (lastProcessedTime > fiveMinutesAgo) return false;
  }
  
  return true;
}

```

### 3. API Service Enhancement

Update the API service to handle the new conversation data structure and implement request cancellation to prevent race conditions. When a user is actively chatting, multiple API requests might be triggered in rapid succession. Without proper management, this could result in:

1. Wasted backend processing for requests that are no longer relevant
2. Race conditions where an older request completes after a newer one, overwriting the more recent results
3. Poor user experience due to flickering UI as different results appear

Our implementation solves these issues by:
- Cancelling in-flight requests when a new one is started for the same conversation
- Adding request timeouts to prevent hanging requests
- Properly handling cancellation events to avoid error logs for expected cancellations

**Location**: `/apps/serengpty-extension/src/services/api.ts`

```typescript
export interface UpsertConversationData {
  id: string;
  title: string;
  userId: string;
  content: string; // Stringified messages array
}

export interface SimilarUser {
  userId: string;
  userName: string;
  conversationId: string;
  title: string;
  distance: number;
  createdAt: string;
}

// Keep track of ongoing requests to allow cancellation
const activeRequests = new Map<string, AbortController>();

export async function upsertConversation(data: UpsertConversationData): Promise<SimilarUser[]> {
  try {
    // Cancel any existing request for this conversation
    if (activeRequests.has(data.id)) {
      console.log(`Cancelling existing request for conversation ${data.id}`);
      activeRequests.get(data.id)?.abort();
      activeRequests.delete(data.id);
    }
    
    // Create a new abort controller for this request
    const abortController = new AbortController();
    activeRequests.set(data.id, abortController);
    
    // Add timeout of 30 seconds
    const timeoutId = setTimeout(() => {
      if (activeRequests.has(data.id)) {
        console.log(`Request for conversation ${data.id} timed out after 30s`);
        abortController.abort();
        activeRequests.delete(data.id);
      }
    }, 30000);
    
    try {
      const response = await fetch(
        `${formatApiUrl(API_BASE_URL)}/upsert-conversation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: abortController.signal
        }
      );
  
      clearTimeout(timeoutId);
      activeRequests.delete(data.id);
  
      if (!response.ok) {
        throw new Error(
          `Failed to upsert conversation with status: ${response.status}`
        );
      }
  
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
      if (activeRequests.get(data.id) === abortController) {
        activeRequests.delete(data.id);
      }
    }
  } catch (error) {
    // Don't log or rethrow if this was a cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Request was cancelled');
      return [];
    }
    
    console.error('Error upserting conversation:', error);
    throw error;
  }
}
```

### 4. SimilarUsersTab Component Implementation

Create the component to display similar users. This component orchestrates the conversation extraction, processing, and display of similar users. Key aspects of this implementation:

1. **Only Process Complete Pairs**: We only trigger processing when we have at least one complete user+assistant message pair, ensuring the backend has meaningful content to analyze.

2. **Content Comparison**: Before sending to the API, we compare the current content with the previously processed content. This prevents redundant API calls when the DOM changes but the actual conversation hasn't.

3. **Loading States**: We provide clear loading states and error handling to ensure a good user experience, even when processing takes time or errors occur.

4. **Cached Results**: We leverage the cached results from our state manager to quickly show previously computed similar users.

**Location**: `/apps/serengpty-extension/src/components/dashboard/SimilarUsersTab.tsx`

```typescript
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@enclaveid/ui/card';
import { Button } from '@enclaveid/ui/button';
import { Avatar } from '@enclaveid/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useConversation } from '../../hooks/useConversation';
import { useExtractConversation } from '../../hooks/useExtractConversation';
import { upsertConversation } from '../../services/api';
import { userDataStorage, updateConversationState, shouldProcessConversation, conversationStatesStorage, SimilarUser } from '../../utils/storage';

export function SimilarUsersTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const { conversationId } = useConversation();
  
  const { messages, isProcessing } = useExtractConversation(conversationId);
  
  useEffect(() => {
    // Only process if we have a conversation ID, messages, and not currently processing
    if (!conversationId || messages.length === 0 || isProcessing) return;
    
    // Ensure we have at least one complete user+assistant pair
    if (messages.length < 2) return;
    
    // Ensure the last message is from the assistant (complete pair)
    const lastMessageIsAssistant = messages[messages.length - 1].role === 'assistant';
    if (!lastMessageIsAssistant) return;
    
    const processConversation = async () => {
      try {
        // Check if we've already processed the same messages
        const currentContent = JSON.stringify(messages);
        const states = await conversationStatesStorage.getValue();
        const state = states[conversationId];
        
        if (state?.lastContent === currentContent) {
          // Same content, use cached results
          if (state?.similarUsers) {
            setSimilarUsers(state.similarUsers);
            return;
          }
        }
        
        setIsLoading(true);
        setError(null);
        
        // Update state to processing
        await updateConversationState(conversationId, { 
          status: 'processing',
          lastProcessed: new Date().toISOString(),
          lastContent: currentContent
        });
        
        // Get user data
        const userData = await userDataStorage.getValue();
        if (!userData?.userId) {
          throw new Error('User not authenticated');
        }
        
        // Send to API
        const result = await upsertConversation({
          id: conversationId,
          title: `Conversation ${conversationId}`,
          userId: userData.userId,
          content: currentContent
        });
        
        // Update state with results
        setSimilarUsers(result);
        await updateConversationState(conversationId, {
          status: 'completed',
          similarUsers: result
        });
      } catch (err) {
        console.error('Error processing conversation:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        await updateConversationState(conversationId, { status: 'idle' });
      } finally {
        setIsLoading(false);
      }
    };
    
    processConversation();
  }, [conversationId, messages, isProcessing]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Finding similar users...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error: {error}</p>
        <Button 
          variant="outline" 
          className="mt-2"
          onClick={() => {
            if (conversationId) {
              updateConversationState(conversationId, { status: 'idle' })
                .then(() => window.location.reload());
            }
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
  
  if (similarUsers.length === 0) {
    return (
      <div className="p-4 text-center">
        <p>No similar users found. Try a different conversation.</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium">Similar Conversations</h3>
      {similarUsers.map((user) => (
        <Card key={user.userId + user.conversationId} className="hover:bg-muted/50 cursor-pointer">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  <span>{user.userName.charAt(0)}</span>
                </Avatar>
                <CardTitle className="text-md font-medium">{user.userName}</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">
                Similarity: {(user.distance * 100).toFixed(0)}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm truncate">{user.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 5. Background Script Enhancement

Update the background script to handle conversation changes and state updates. The background script serves as a central coordination point that:

1. Listens for conversation change events from content scripts
2. Updates the conversation state when changes are detected
3. Ensures consistent state management across the extension

**Location**: `/apps/serengpty-extension/src/entrypoints/background.ts`

```typescript
import { handleAuthentication } from '../utils/authentication';
import { handleOpenSidepanel } from '../utils/sidepanel';
import { updateConversationState } from '../utils/storage';

export default defineBackground(() => {
  handleOpenSidepanel();
  handleAuthentication();
  
  // Listen for conversation changes
  browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'conversationChanged' && message.conversationId) {
      // Mark the conversation as idle when it changes to trigger reprocessing
      await updateConversationState(message.conversationId, { 
        status: 'idle'
      });
    }
  });
});
```

## Implementation Order and Testing Strategy

### Implementation Sequence

1. Create the `useExtractConversation.ts` hook to monitor conversation changes
2. Enhance the storage.ts file with new conversation state management functions
3. Update the API service to handle the new data structure and implement request cancellation
4. Implement the SimilarUsersTab component with proper state management
5. Update the background script to handle conversation changes
6. Test the functionality end-to-end

### Testing Strategy

To ensure robust functionality, we should test the implementation across these scenarios:

1. **DOM Parsing Reliability**: Test with various ChatGPT conversation layouts and patterns
   - Short vs. long conversations
   - Code blocks and complex formatting
   - Edits to previous messages

2. **State Management**: Verify that conversation state is properly tracked
   - Confirm that repeated messages aren't reprocessed
   - Verify that state changes on actual content changes
   - Test throttling behavior

3. **Request Handling**: Ensure the request cancellation system works correctly
   - Rapid conversation changes should cancel earlier requests
   - Timeout should trigger for long-running requests
   - Completed requests should update UI correctly

4. **Error Handling**: Validate the error recovery mechanisms
   - Network failures should display appropriate errors
   - Retry should work correctly
   - Edge cases like empty conversations or malformed responses should be handled

