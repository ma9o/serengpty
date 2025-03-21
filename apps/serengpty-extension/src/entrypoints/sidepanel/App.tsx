import { useHandleCloseSidepanel } from '../../hooks/useHandleCloseSidepanel';
import { ConversationProvider, useConversation } from '../../providers';
import { isActivatedConversation } from '../../utils/storage';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dashboard } from '../../components/dashboard/Dashboard';
import { ChatWrapper } from '../../components/ChatWrapper';
import { Confirmation } from '../../components/Confirmation';

// Inner component that uses the conversation context
function AppContent() {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const { conversationId } = useConversation();

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

  // Handle unread count changes from ChatProvider
  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  const isLoading = isActivated === null;

  // The content to render based on activation state
  const content = isLoading ? (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-10 h-10 animate-spin" /> Looking for ChatGPT
      conversations...
    </div>
  ) : !isActivated ? (
    <Confirmation
      conversationId={conversationId!}
      onConfirm={() => {
        setIsActivated(true);
      }}
    />
  ) : (
    <Dashboard unreadCount={unreadCount} />
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <ChatWrapper onUnreadCountChange={handleUnreadCountChange}>
        {content}
      </ChatWrapper>
    </div>
  );
}

// Main app component that wraps everything in providers
function App() {
  return (
    <ConversationProvider>
      <AppContent />
    </ConversationProvider>
  );
}

export default App;