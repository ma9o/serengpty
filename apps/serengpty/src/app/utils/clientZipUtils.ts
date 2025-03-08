'use client';

import { Unzip, UnzipInflate } from 'fflate';
import clarinet from 'clarinet';

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
 * @returns the cleaned text.
 */
function cleanText(text: string): string {
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
    if (word.length > 5 && getShannonEntropy(word) > 4.5) {
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
    console.log('Redaction:', redactions, 'Redacted content:', redactedContent);
  }
  return cleaned;
}

/**
 * Processes a ZIP file, extracting and processing only 'conversations.json'.
 * Stops reading early once conversations.json is fully processed.
 * Only logs found files and redactions.
 * @param file the uploaded ZIP file.
 * @returns Promise with cleaned conversations.
 */
export async function processZipFile(file: File): Promise<{
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

    // Handle files within the ZIP
    unzipper.onfile = (unzippedFile) => {
      console.log('Found file:', unzippedFile.name);
      if (unzippedFile.name === 'conversations.json') {
        foundConversations = true;

        const parser = clarinet.parser();
        const stack: any[] = [];
        const records: Record<string, unknown>[] = [];
        let currentKey: string | null = null;
        let inPartsArray = false;

        unzippedFile.ondata = (err, data, final) => {
          if (err) {
            doResolve({ success: false, conversations: null });
            return;
          }
          const text = new TextDecoder().decode(data);
          parser.write(text);

          if (final) {
            parser.close();
            doResolve({
              success: true,
              conversations: records,
            });
            stopReading = true;
          }
        };

        // JSON parser event handlers without extra logging
        parser.onopenarray = () => {
          const parent = stack[stack.length - 1];
          const arr: any[] = [];
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
          if (inPartsArray && typeof value === 'string') {
            value = cleanText(value);
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
            records.push(obj);
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
