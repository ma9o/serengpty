'use client';

import { Unzip, UnzipInflate } from 'fflate';
import clarinet from 'clarinet';

const ENTROPY_THRESHOLD = 4.5;
const MIN_LENGTH = 12;

/**
 * Calculates the Shannon entropy of a string.
 * @param s the input string.
 * @returns the entropy in bits.
 */
function getShannonEntropy(s: string): number {
  const len = s.length;
  const frequencies: { [char: string]: number } = {};
  for (const char of s) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Regular expressions for redaction
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g;

/**
 * Cleans a single string by redacting sensitive information.
 * Only logs if redactions occur.
 * @param text the input text.
 * @param conversationTitle the title of the conversation being processed.
 * @returns the cleaned text.
 */
function cleanText(text: string, conversationTitle?: string): string {
  const redactions: string[] = [];
  const redactedContent: string[] = [];

  // Capture email redactions
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    redactions.push('email');
    redactedContent.push(...emailMatch);
  }

  // Capture phone redactions
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    redactions.push('phone');
    redactedContent.push(...phoneMatch);
  }

  let cleaned = text
    .replace(emailRegex, '[redacted email]')
    .replace(phoneRegex, '[redacted phone]');

  // Apply entropy check on individual words
  const words = cleaned.split(/\s+/);
  let hasHighEntropyWords = false;
  const highEntropyWords: string[] = [];

  const processedWords = words.map((word) => {
    // Only check words longer than a minimal length
    if (
      word.length >= MIN_LENGTH &&
      getShannonEntropy(word) > ENTROPY_THRESHOLD
    ) {
      hasHighEntropyWords = true;
      highEntropyWords.push(word);
      return '[redacted high entropy]';
    }
    return word;
  });

  if (hasHighEntropyWords) {
    redactions.push('high entropy');
    redactedContent.push(...highEntropyWords);
    cleaned = processedWords.join(' ');
  }

  if (redactions.length > 0) {
    console.log(
      'Redaction in conversation: "',
      conversationTitle,
      '"',
      redactedContent,
      redactions
    );
  }
  return cleaned;
}

/**
 * Processes a ZIP file, extracting and processing only 'conversations.json'.
 * Stops reading early once conversations.json is fully processed.
 * Only logs found files and redactions.
 * @param file the uploaded ZIP file.
 * @param onProgress callback function to report progress percentage
 * @returns Promise with cleaned conversations.
 */
export async function processZipFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{
  success: boolean;
  conversations: Record<string, unknown>[] | null;
}> {
  let resolvePromise: (value: {
    success: boolean;
    conversations: Record<string, unknown>[] | null;
  }) => void;
  let resolved = false;
  const doResolve = (value: {
    success: boolean;
    conversations: Record<string, unknown>[] | null;
  }) => {
    if (!resolved) {
      resolved = true;
      resolvePromise(value);
    }
  };

  const promise = new Promise<{
    success: boolean;
    conversations: Record<string, unknown>[] | null;
  }>((resolve) => {
    resolvePromise = resolve;
  });

  try {
    const unzipper = new Unzip();
    unzipper.register(UnzipInflate);
    let foundConversations = false;
    let stopReading = false;
    let totalSize = 0;
    let processedSize = 0;

    // Handle files within the ZIP
    unzipper.onfile = (unzippedFile) => {
      console.log('Found file:', unzippedFile.name);
      if (unzippedFile.name === 'conversations.json') {
        foundConversations = true;
        totalSize = unzippedFile.size;

        const parser = clarinet.parser();
        const stack: any[] = [];
        const records: Record<string, unknown>[] = [];
        let currentKey: string | null = null;
        let inPartsArray = false;
        let topLevelArray = false;

        // Add this variable to track the current conversation index
        let currentConversationIndex = -1;

        // Add these state variables to track the current conversation
        let currentConversation: Record<string, unknown> | null = null;
        let currentConversationTitle = 'Unknown Conversation';

        unzippedFile.ondata = (err, data, final) => {
          if (err) {
            doResolve({ success: false, conversations: null });
            return;
          }

          processedSize += data.length;
          const progressPercentage = Math.min(
            Math.round((processedSize / totalSize) * 100),
            100
          );

          if (onProgress) {
            onProgress(progressPercentage);
          }

          const text = new TextDecoder().decode(data);
          parser.write(text);

          if (final) {
            parser.close();
            if (onProgress) {
              onProgress(100); // Ensure we finish at 100%
            }
            doResolve({
              success: true,
              conversations: records,
            });
            stopReading = true;
          }
        };

        // JSON parser event handlers without extra logging
        parser.onopenarray = () => {
          const arr: any[] = [];
          if (stack.length === 0) {
            // This is the top-level array of conversations
            topLevelArray = true;
            stack.push(arr);
            return;
          }

          const parent = stack[stack.length - 1];
          if (Array.isArray(parent)) {
            parent.push(arr);
          } else if (currentKey) {
            if (currentKey === 'parts') {
              inPartsArray = true;
            }
            parent[currentKey] = arr;
          }
          stack.push(arr);
        };

        parser.onclosearray = () => {
          const closedArray = stack.pop();
          if (topLevelArray && stack.length === 0) {
            // We're closing the top-level array, all conversations should be in records
            return;
          }

          if (
            stack.length > 0 &&
            !Array.isArray(stack[stack.length - 1]) &&
            stack[stack.length - 1]['parts'] === closedArray
          ) {
            inPartsArray = false;
          }
        };

        parser.onopenobject = (key) => {
          const obj: Record<string, unknown> = {};
          if (stack.length === 0) {
            stack.push(obj);
          } else {
            const parent = stack[stack.length - 1];
            if (Array.isArray(parent)) {
              parent.push(obj);
              // If we're in the top-level array, this is a new conversation
              if (topLevelArray && stack.length === 1) {
                currentConversation = obj;
                currentConversationTitle = 'Unknown Conversation';
              }
            } else if (currentKey) {
              parent[currentKey] = obj;
            }
          }
          stack.push(obj);
          if (key) currentKey = key;
        };

        parser.onkey = (key) => {
          currentKey = key;
        };

        parser.onvalue = (value) => {
          // Update the conversation title when we encounter it
          if (
            currentKey === 'title' &&
            stack.length > 0 &&
            stack[stack.length - 1] === currentConversation
          ) {
            currentConversationTitle = value as string;
          }

          if (inPartsArray && typeof value === 'string') {
            // Use the tracked conversation title
            value = cleanText(value, currentConversationTitle);
          }
          const parent = stack[stack.length - 1];
          if (Array.isArray(parent)) {
            parent.push(value);
          } else if (currentKey) {
            parent[currentKey] = value;
          }
        };

        parser.oncloseobject = () => {
          const obj = stack.pop();
          if (stack.length > 0 && Array.isArray(stack[stack.length - 1])) {
            if (topLevelArray && stack.length === 1) {
              // This is a conversation object in the top-level array
              records.push(obj);
              currentConversationIndex = records.length - 1;
              // Reset current conversation when we're done with it
              currentConversation = null;
            }
          }
        };

        parser.onerror = (e) => {
          doResolve({ success: false, conversations: null });
        };

        unzippedFile.start();
      }
    };

    const reader = file.stream().getReader();
    while (true) {
      if (stopReading) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        if (!foundConversations) {
          doResolve({ success: false, conversations: null });
        }
        break;
      }
      if (value) {
        unzipper.push(value, false);
      }
    }
  } catch (error) {
    doResolve({ success: false, conversations: null });
  }

  return promise;
}
