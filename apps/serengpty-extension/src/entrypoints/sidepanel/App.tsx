import { useHandleCloseSidepanel } from '../../hooks/useHandleCloseSidepanel';
import { Confirmation } from '../../components/Confirmation';
import { useCurrentConversation } from '../../hooks/useCurrentConversation';
import { isActivatedConversation } from '../../utils/storage';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dashboard } from '../../components/dashboard/Dashboard';
import { ChatWrapper } from '../../components/ChatWrapper';

function App() {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const { conversationId, isLoading: isLoadingConversation } =
    useCurrentConversation();

  useHandleCloseSidepanel();

  useEffect(() => {
    if (conversationId) {
      isActivatedConversation(conversationId).then((isActivated) => {
        setIsActivated(isActivated);
      });
    }
  }, [conversationId]);

  // Handle unread count changes from ChatProvider
  const handleUnreadCountChange = (count: number) => {
    setUnreadCount(count);
  };

  const isLoading = isLoadingConversation || isActivated === null;

  // The content to render based on activation state
  const content = isLoading ? (
    <Loader2 className="w-10 h-10 animate-spin" />
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

export default App;
