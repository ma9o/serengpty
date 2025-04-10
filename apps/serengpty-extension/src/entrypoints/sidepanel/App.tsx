import { useHandleCloseSidepanel } from '../../hooks/useHandleCloseSidepanel';
import { ConversationProvider, useConversation } from '../../providers';
import { isActivatedConversation } from '../../utils/storage';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dashboard } from '../../components/dashboard/Dashboard';
import { ChatWrapper } from '../../components/ChatWrapper';
import { Confirmation } from '../../components/Confirmation';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Logo } from '@enclaveid/ui/logo';

// Inner component that contains the UI content without ChatWrapper
function AppContentInner({ unreadCount }: { unreadCount: number }) {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const { 
    conversationId, 
    title, 
    processingError, 
    processConversation,
    clearProcessingError
  } = useConversation();

  useHandleCloseSidepanel();

  useEffect(() => {
    if (conversationId) {
      // When conversation ID changes (navigation or initial load)
      // Check if this conversation is already activated
      isActivatedConversation(conversationId).then((isActivated) => {
        setIsActivated(isActivated);
      });
    } else {
      // Reset state when no conversation is active
      setIsActivated(null);
    }
  }, [conversationId]);

  const isLoading = isActivated === null;

  // If there's a processing error, display the error banner instead of normal content
  if (processingError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="w-full max-w-md">
          <ErrorBanner 
            message={`Failed to process conversation data: ${processingError}`}
            onRetry={() => {
              // Force refresh when retrying
              if (conversationId) {
                // Clear the error first, then force refresh
                clearProcessingError();
                processConversation(true);
              }
            }}
            onDismiss={() => {
              // Allow user to dismiss the error
              clearProcessingError();
            }}
          />
          <div className="p-4 text-center mt-4">
            <p className="text-sm text-gray-500">
              We encountered an error while processing your conversation. 
              Please try again or come back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // The content to render based on activation state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 animate-spin" /> Looking for ChatGPT
        conversations...
      </div>
    );
  }

  if (!conversationId || !title) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 animate-spin" /> Waiting for conversation
        data...
      </div>
    );
  }

  if (!isActivated) {
    return (
      <Confirmation
        conversationId={conversationId}
        title={title}
        onConfirm={() => {
          setIsActivated(true);
        }}
      />
    );
  }

  return <Dashboard unreadCount={unreadCount} />;
}

// Main app component that wraps everything in providers
function App() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Handle unread count changes from ChatProvider
  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  return (
    <div className="w-screen h-screen overflow-y flex flex-col items-center justify-top p-4 gap-4">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-2xl font-bold">SerenGPTy</span>
      </div>
      <ConversationProvider>
        <ChatWrapper onUnreadCountChange={handleUnreadCountChange}>
          <AppContentInner unreadCount={unreadCount} />
        </ChatWrapper>
      </ConversationProvider>
    </div>
  );
}

export default App;
