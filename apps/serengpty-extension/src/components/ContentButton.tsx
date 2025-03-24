import { Logo } from '@enclaveid/ui';
import { dispatchOpenSidepanel } from '../utils/messaging/content';

export function ContentButton() {
  return (
    <button
      onClick={() => dispatchOpenSidepanel({})}
      className="p-1 flex items-center justify-center w-9 h-9 rounded-full bg-white transition-colors"
      title="Find Similar Users"
    >
      <Logo />
    </button>
  );
}
