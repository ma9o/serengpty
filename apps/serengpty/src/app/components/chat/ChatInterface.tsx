'use client';

import { ChatInterface as SharedChatInterface } from '@enclaveid/ui';
import { useIsMobile } from '@enclaveid/ui/hooks/use-mobile';
import { getIdenticon } from '../../utils/getIdenticon';

interface ChatInterfaceProps {
  activeChannelId?: string;
}

export const ChatInterface = ({
  activeChannelId,
}: ChatInterfaceProps) => {
  // Get mobile state
  const isMobile = useIsMobile();
  
  // Use the shared ChatInterface component with our local getIdenticon implementation
  return (
    <SharedChatInterface 
      activeChannelId={activeChannelId} 
      isMobile={isMobile} 
      getIdenticon={getIdenticon} 
    />
  );
};
