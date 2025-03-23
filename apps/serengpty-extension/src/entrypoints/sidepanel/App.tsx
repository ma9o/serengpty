import { useHandleCloseSidepanel } from '../../hooks/useHandleCloseSidepanel';
import { ConversationProvider, useConversation } from '../../providers';
import { isActivatedConversation } from '../../utils/storage';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dashboard } from '../../components/dashboard/Dashboard';
import { ChatWrapper } from '../../components/ChatWrapper';
import { Confirmation } from '../../components/Confirmation';

// Inner component that contains the UI content without ChatWrapper
function AppContentInner({ unreadCount }: { unreadCount: number }) {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const { conversationId, title } = useConversation();

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
    <div className="w-full h-full flex flex-col items-center justify-center">
      <ConversationProvider>
        <ChatWrapper onUnreadCountChange={handleUnreadCountChange}>
          <AppContentInner unreadCount={unreadCount} />
        </ChatWrapper>
      </ConversationProvider>
    </div>
  );
}

export default App;
