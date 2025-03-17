import { test, expect } from '@playwright/test';

test('file upload and account creation', async ({ page }) => {
  const filePath = '';
  const username = '';
  const password = '';

  console.log(`Using file path: ${filePath}`);
  console.log(`Using username: ${username}`);
  console.log(`Using password: ${password.replace(/./g, '*')}`);

  // Navigate to the homepage
  await page.goto('/');

  // Wait for page to fully load - using domcontentloaded instead of networkidle
  await page.waitForLoadState('domcontentloaded');

  // Initialize elements that will be used throughout the test
  const loggedInElement = page.locator(
    "text=You've already uploaded your archive"
  );
  const dropzone = page.locator('div[class*="border-dashed"]');
  const fileInput = page.locator('input[type="file"]');
  const progressBar = page.locator('div[class*="bg-green-600"]');
  const archiveReadyMessage = page.locator(
    'text=Your archive is ready to be uploaded'
  );
  const usernameInput = page.locator('input#username');
  const passwordInput = page.locator('input#password');
  const greenCheckmark = page.locator('svg.text-green-500');
  const uploadButton = page.locator(
    'button:has-text("Upload zip and Sign up")'
  );
  const uploadingMessage = page.locator('text=Uploading data...');

  // Test for already logged in state
  const isLoggedIn = await loggedInElement.isVisible();
  if (isLoggedIn) {
    console.log(
      'User is already logged in. Keeping browser open for inspection.'
    );

    await new Promise<never>(() => {
      /* Keep browser open */
    });
    return;
  }

  // Verify the upload interface is visible and proceed with file upload
  await expect(dropzone).toBeVisible();
  await fileInput.setInputFiles(filePath);

  // Wait for file processing to complete
  await expect(progressBar).toBeVisible({ timeout: 60000 });
  await expect(archiveReadyMessage).toBeVisible({ timeout: 120000 });

  // Fill in account creation form
  await expect(usernameInput).toBeVisible();
  await usernameInput.clear();
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  // Wait for validation and proceed
  await expect(greenCheckmark).toBeVisible();
  await expect(uploadButton).toBeEnabled();
  await uploadButton.click();

  // Wait for upload process
  await expect(uploadingMessage).toBeVisible({ timeout: 30000 });

  // Wait for redirect to onboarding or dashboard page
  await page.waitForURL(/.*\/onboarding|.*\/dashboard/, { timeout: 120000 });

  // Verify that we've successfully signed up and redirected
  expect(page.url()).toMatch(/.*\/onboarding|.*\/dashboard/);

  console.log('Successfully signed up! Keeping browser open for inspection.');
  console.log('URL after signup:', page.url());
  console.log('Press Ctrl+C when you want to close the browser.');

  // Wait indefinitely until the process is manually terminated

  await new Promise<never>(() => {
    /* Keep browser open */
  });
});
