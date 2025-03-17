# E2E Tests with Playwright

This directory contains end-to-end tests for the Serengpty application using Playwright.

## Available Tests

### `file-upload-signup.spec.ts`

Automates the process of:
1. Uploading a zip file
2. Creating a new account with a specified username and password
3. Keeping the browser open for manual inspection after completion

#### Usage

Run the test with environment variables to specify the file path, username, and password:

```bash
FILEPATH=/path/to/file.zip USERNAME=yourname PASSWORD=yourpassword npx playwright test file-upload-signup --headed
```

> **Note:** The `--headed` flag is required to keep the browser window open for inspection.

#### Parameters

- `FILEPATH`: Path to the zip file to upload
- `USERNAME`: Username for account creation
- `PASSWORD`: Password for account creation

#### Example

```bash
FILEPATH=~/Downloads/my_chat_export.zip USERNAME=testuser1 PASSWORD=securepass123 npx playwright test file-upload-signup --headed
```

## Setup

Ensure you have Playwright installed. If not, run:

```bash
npx playwright install
```

## Running Tests

To run a specific test:

```bash
npx playwright test <test-name>
```

To run all tests:

```bash
npx playwright test
```

For more information, see the [Playwright documentation](https://playwright.dev/docs/intro).