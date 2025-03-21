import { useHandleCloseSidepanel } from '../../hooks/useHandleCloseSidepanel';
import { Confirmation } from '../../components/Confirmation';
import { useCurrentConversation } from '../../hooks/useCurrentConversation';
import { isActivatedConversation } from '../../utils/storage';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

function App() {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);

  const { conversationId, conversationTitle } = useCurrentConversation();

  useHandleCloseSidepanel();

  useEffect(() => {
    if (conversationId && conversationTitle) {
      isActivatedConversation(conversationId).then((isActivated) => {
        setIsActivated(isActivated);
      });
    }
  }, [conversationId, conversationTitle]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {isActivated === null ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      ) : !isActivated ? (
        <Confirmation
          conversationId={conversationId!}
          conversationTitle={conversationTitle!}
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
