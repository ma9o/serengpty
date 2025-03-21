import { useHandleCloseSidepanel } from '../../hooks/useHandleCloseSidepanel';
import { Confirmation } from '../../components/Confirmation';
import { useCurrentConversation } from '../../hooks/useCurrentConversation';
import { isActivatedConversation } from '../../utils/storage';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

function App() {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);

  const {
    conversationId,
    conversationTitle,
    isLoading: isLoadingConversation,
  } = useCurrentConversation();

  useHandleCloseSidepanel();

  useEffect(() => {
    if (conversationId && conversationTitle) {
      isActivatedConversation(conversationId).then((isActivated) => {
        setIsActivated(isActivated);
      });
    }
  }, [conversationId, conversationTitle]);

  const isLoading = isLoadingConversation || isActivated === null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {isLoading ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      ) : !isActivated ? (
        <Confirmation
          conversationId={conversationId!}
          conversationTitle={conversationTitle!}
          onConfirm={() => {
            setIsActivated(true);
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          {/* TODO: Add a success message */}
        </div>
      )}
    </div>
  );
}

export default App;
