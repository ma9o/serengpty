// Function to create and mount a round button before the selected div
/**
 * Mounts a round button before the selected div using XPath for element selection.
 * The function targets a specific element in the DOM hierarchy under composer-background.
 */
export function mountButton(): void {
  // Find the root element using the composer-background ID
  const composerBackground = document.getElementById('composer-background');

  if (!composerBackground) {
    console.error('Root element with ID "composer-background" not found');
    return;
  }

  // Find the selected div using XPath for a more legible approach
  // This targets: first child > second child > second child under composer-background
  const xpath = './div[1]/div[2]/div[2]';
  const result = document.evaluate(
    xpath,
    composerBackground,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );

  const selectedDiv = result.singleNodeValue as HTMLElement;

  if (!selectedDiv) {
    console.error('Selected div not found via XPath selection');
    return;
  }

  // Create the round button element
  const roundButton = document.createElement('button');

  // Set button styles for a round button
  roundButton.style.borderRadius = '50%';
  roundButton.style.width = '36px';
  roundButton.style.height = '36px';
  roundButton.style.display = 'flex';
  roundButton.style.alignItems = 'center';
  roundButton.style.justifyContent = 'center';
  roundButton.style.backgroundColor = '#3a86ff'; // Blue color, adjust as needed
  roundButton.style.border = 'none';
  roundButton.style.cursor = 'pointer';
  roundButton.style.marginRight = '8px';
  roundButton.style.color = 'white';

  // Add button content (can be text, icon, etc.)
  roundButton.innerHTML = '+'; // Example content, replace as needed

  // Add hover effect
  roundButton.addEventListener('mouseover', () => {
    roundButton.style.backgroundColor = '#2563eb'; // Darker blue on hover
  });

  roundButton.addEventListener('mouseout', () => {
    roundButton.style.backgroundColor = '#3a86ff'; // Return to original color
  });

  // Add click event listener (customize this as needed)
  roundButton.addEventListener('click', () => {
    console.log('Round button clicked');
    // Add your click handler logic here
  });

  // Insert the button before the selected div
  selectedDiv.parentNode?.insertBefore(roundButton, selectedDiv);
}
