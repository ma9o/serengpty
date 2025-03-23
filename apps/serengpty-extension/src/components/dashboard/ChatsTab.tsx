import { getIdenticon } from '@enclaveid/shared-utils';
import { ChatInterface } from '@enclaveid/ui';

export function ChatsTab() {
  return (
    <div className="h-[500px] w-full overflow-hidden">
      <ChatInterface isMobile={true} getIdenticon={getIdenticon} />
    </div>
  );
}
