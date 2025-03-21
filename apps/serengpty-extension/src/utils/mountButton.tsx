import { createRoot } from 'react-dom/client';
import { ContentButton } from '../components/ContentButton';
/**
 * Mounts a round button before the selected div using XPath for element selection.
 * The function targets a specific element in the DOM hierarchy under composer-background.
 */
export function mountButton(conversationId: string): void {
  const composerBackground = document.getElementById('composer-background');

  if (!composerBackground) {
    console.error('Root element with ID "composer-background" not found');
    return;
  }

  const xpath = './div[1]/div[2]/div[2]';
  const result = document.evaluate(
    xpath,
    composerBackground,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );

  const targetElement = result.singleNodeValue as HTMLElement;

  if (!targetElement) {
    console.error('Selected div not found via XPath selection');
    return;
  }

  const reactContainer = document.createElement('div');

  targetElement.parentNode?.insertBefore(reactContainer, targetElement);

  const root = createRoot(reactContainer);
  root.render(<ContentButton conversationId={conversationId} />);
}
