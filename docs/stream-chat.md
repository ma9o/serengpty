# Stream Chat Architecture

This document outlines how Stream Chat is implemented in the Serengpty project. The goal is to centralize Stream Chat functionality in the `libs/shared-utils` directory, making it agnostic of Prisma and Next.js, to facilitate reuse across applications, particularly in the Serengpty extension.

## Current Implementation

### Core Components

1. **ChatProvider** - `/apps/serengpty/src/app/components/chat/ChatProvider.tsx`
   - Creates and manages the Stream Chat client
   - Provides a context with chat state and functions
   - Handles authentication with user token
   - Tracks unread messages count and notifications
   - Manages active channel and initial chat text

2. **ChatInterface** - `/apps/serengpty/src/app/components/chat/ChatInterface.tsx`
   - Renders the Stream Chat UI with custom styling
   - Implements responsive design for mobile/desktop
   - Uses custom avatar component with identicons
   - Manages channel selection and navigation

3. **ChatButton** - `/apps/serengpty/src/app/components/chat/ChatButton.tsx`
   - Creates direct message channels between users
   - Handles navigation to the chat page with the correct channel

### Server-Side Functions

1. **getChatToken** - `/apps/serengpty/src/app/actions/getChatToken.ts`
   - Server action that generates Stream Chat tokens
   - Uses server-side Stream Chat client with API secret
   - Requires authenticated user

2. **upsertStreamChatUser** - `/apps/serengpty/src/app/utils/upsertStreamChatUser.ts`
   - Creates or updates a user in Stream Chat
   - Maps Prisma User model to Stream Chat user
   - Uses server-side credentials

### Configuration & Styling

1. **Environment Variables**
   - `NEXT_PUBLIC_STREAM_CHAT_API_KEY` - Client-side API key
   - `STREAM_CHAT_API_SECRET` - Server-side secret

2. **Custom CSS** - `/apps/serengpty/src/app/styles/stream-chat-custom.css`
   - Customizes Stream Chat UI appearance
   - Hides username in chat messages

### Integration Points

1. **Dashboard Layout** - `/apps/serengpty/src/app/(pages)/dashboard/layout.tsx`
   - Initializes ChatProvider at dashboard level
   - Provides chat token and user info to ChatProvider

2. **Dashboard Sidebar** - `/apps/serengpty/src/app/components/dashboard-sidebar.tsx`
   - Displays unread message count from chat context
   - Links to chat page

3. **Chat Page** - `/apps/serengpty/src/app/(pages)/dashboard/chats/page.tsx`
   - Renders the ChatInterface component
   - Shows loading/error states from chat context

### Utility Scripts

1. **resetStreamChat.ts** - `/apps/serengpty/prisma/resetStreamChat.ts`
   - Maintenance script to reset Stream Chat data
   - Deletes users and their conversations

## Refactoring Strategy

The refactoring will separate backend functionality into `libs/shared-utils` and frontend components into `libs/ui` and `libs/ui-utils`:

### Backend (`libs/shared-utils`)

1. **Chat Client Service**
   - Abstract client initialization and token generation
   - Remove Next.js and Prisma dependencies
   - Implement server-side methods (upsertUser, createToken)

2. **Chat Data Models**
   - Define TypeScript interfaces for chat entities
   - Create data transformation utilities

3. **Adapter Pattern**
   - Abstract user management between different data sources
   - Create agnostic interfaces for authentication methods

4. **Configuration Management**
   - Environment variable handling
   - Service configuration

5. **Notification Management**
   - Platform-agnostic notification interfaces
   - Methods to handle unread counts and message events

### Frontend (`libs/ui` and `libs/ui-utils`)

1. **UI Components (`libs/ui`)**
   - Move ChatInterface component (without business logic)
   - Create ChatButton component
   - Other reusable UI pieces (message bubbles, input areas)
   - Notification indicators and badges

2. **UI Logic (`libs/ui-utils`)**
   - Move ChatProvider and context implementation
   - React hooks for chat functionality
   - Client-side chat operations
   - Notification handling hooks and utilities

3. **Style Management**
   - Move custom styles to `libs/ui-utils`
   - Configure styling to work across applications

## Implementation Status

### Completed

1. **Backend (shared-utils)**
   - ✅ Created base interfaces for Stream Chat entities
   - ✅ Implemented StreamChatService for token generation and user management
   - ✅ Added notification event types

2. **Frontend (ui-utils)**
   - ✅ Extracted ChatProvider context to be framework-agnostic
   - ✅ Created hooks for managing chat state and operations
   - ✅ Implemented notification handling and unread count hooks
   - ✅ Implemented shared styling

3. **UI Components (ui)**
   - ✅ Refactored chat UI components to use the shared logic
   - ✅ Created notification badge components
   - ✅ Made components work with both Next.js and WXT extension environments

4. **Integration**
   - ✅ Updated the webapp (serengpty) to use the new architecture

### Next Steps

1. **Extension Integration**
   - Implement Stream Chat in the serengpty-extension
   - Add browser-specific notification handling for the extension