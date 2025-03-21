import { Button } from '@enclaveid/ui/button';

export function ContentButton({ conversationId }: { conversationId: string }) {
  const openSidepanel = useCallback(() => {
    browser.runtime.sendMessage({ action: 'openSidepanel' });
  }, [conversationId]);

  return (
    <Button variant="outline" onClick={openSidepanel}>
      Open Sidepanel
    </Button>
  );
}
