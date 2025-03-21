import { Button } from '@enclaveid/ui/button';

export function ContentButton() {
  const openSidepanel = () => {
    browser.runtime.sendMessage({
      action: 'openSidepanel',
    });
  };

  return (
    <Button variant="outline" onClick={openSidepanel}>
      Open Sidepanel
    </Button>
  );
}
