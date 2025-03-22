import { useEffect } from 'react';
import { ProcessingMetadata } from '../types';

/**
 * Hook to handle message content updates from background
 * This version only processes messages received from background and no longer
 * attempts to extract messages directly from the DOM.
 */
export function useExtractMessages(
  conversationId: string | null,
  contentHash: string | null,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setContentHash: React.Dispatch<React.SetStateAction<string | null>>,
  setProcessingMetadata: React.Dispatch<React.SetStateAction<ProcessingMetadata>>
) {
  // We're removing the DOM extraction logic that was causing the bug
  // Instead, the sidepanel will rely entirely on messages sent from the content script
  // through the background.
  
  // This hook is kept for compatibility with the existing architecture,
  // but its functionality is now handled by the message passing system.
  
  // This is now just a no-op hook
  useEffect(() => {
    // No DOM extraction here - messages come only through the message passing system
  }, [conversationId, contentHash, setMessages, setContentHash, setProcessingMetadata]);
}