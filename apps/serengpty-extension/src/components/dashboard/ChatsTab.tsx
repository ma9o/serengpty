import { getIdenticon } from '@enclaveid/shared-utils';
import { ChatInterface } from '@enclaveid/ui';

export function ChatsTab() {
  return (
    <div className="h-[550px] w-full overflow-hidden rounded-lg">
      <ChatInterface isMobile={false} getIdenticon={getIdenticon} />
    </div>
  );
}
