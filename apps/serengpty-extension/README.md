# SerengPTY Browser Extension

## Overview
Browser extension for the SerengPTY platform, enabling interaction with ChatGPT conversations.

## Architecture

### Message Bus
The extension uses a message-based architecture with three main contexts:
- Content Script: Runs in the ChatGPT page context, observes the DOM
- Background Script: Long-running script to handle data processing
- Sidepanel: UI component that displays insights and related content

### Unified Logging
The extension implements a unified logging system for tracking events and message flow:

#### Logger Module (`utils/logger.ts`)
- Context-specific loggers with consistent formatting
- Special event tracking for messages
- Log level support (debug, info, warn, error)

#### Dispatching System (`utils/messaging/`)
- `factory.ts`: Creates type-safe message dispatchers and handlers
- `dispatchMessage.ts`: Central function for sending messages with logging
- Context-specific message dispatchers (content, background, sidepanel)

#### Message Flow
1. Content script observes DOM changes and dispatches events
2. Background script receives events, processes data, and sends updates
3. Sidepanel listens for messages and updates UI accordingly

### Debug Tips
- Open devtools in the extension context to see logs
- All messages are tagged with context: `[serengpty:context]`
- Event messages use the action name and are easy to filter
- To filter logs by context, use "serengpty:content" in the console filter

## Development

### Installation
```bash
# Install dependencies
bun install

# Build extension in dev mode
bun nx run serengpty-extension:dev
```

### Testing
```bash
# Run extension tests
bun nx run serengpty-extension:test
```

### Building for Production
```bash
# Build extension for production
bun nx run serengpty-extension:build
```