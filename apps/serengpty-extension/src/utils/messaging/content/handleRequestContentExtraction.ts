import { RequestContentExtractionMessage } from '../types';
import { contentLogger } from '../../logger';
import { forceContentExtraction } from '../../content/conversationTracker';
import { createMessageHandler } from '../factory';

/**
 * Handles requests from the background script to extract conversation content
 */
export const handleRequestContentExtraction = createMessageHandler<RequestContentExtractionMessage>(
  (message) => {
    const { conversationId } = message;
    
    contentLogger.info('Handling content extraction request', {
      data: { conversationId }
    });
    
    // Force immediate content extraction and dispatch to background
    forceContentExtraction(conversationId);
  },
  'content'
);