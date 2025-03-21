import { ChatInterface } from '@enclaveid/ui';
import { getIdenticon } from '../../utils/identicon';

export function ChatsTab() {
  return (
    <div className="h-[500px] w-full overflow-hidden">
      <ChatInterface isMobile={true} getIdenticon={getIdenticon} />
    </div>
  );
}
