'use client';

import { Unzip } from 'fflate';
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
 * @param text the input text.
 * @returns the cleaned text.
 */
function cleanText(text: string): string {
  const cleaned = text
    .replace(emailRegex, '[redacted email]')
    .replace(phoneRegex, '[redacted phone]');
  if (cleaned.length > 20 && getShannonEntropy(cleaned) > 4.5) {
    return '[redacted high entropy]';
  }
  return cleaned;
}

/**
 * Processes a chunk of records (e.g., send to server or log).
 * @param records the chunk of cleaned records.
 */
function processChunk(records: Record<string, unknown>[]): void {
  console.log('Processing chunk of', records.length, 'records:', records);
  // Optionally, implement custom logic here (e.g., API call)
}

/**
 * Processes a ZIP file, extracting and processing only 'conversations.json'.
 * @param file the uploaded ZIP file.
 * @param chunkSize optional number of records per chunk (default: 100).
 * @param processAll if true, returns all records; if false, processes chunks and returns null.
 * @returns Promise with cleaned conversations or null.
 */
export async function processZipFile(
  file: File,
  chunkSize = 100,
  processAll = true
): Promise<{
  success: boolean;
  conversations: Record<string, unknown>[] | null;
}> {
  try {
    const unzipper = new Unzip();
    let resolvePromise;
    const promise = new Promise<{
      success: boolean;
      conversations: Record<string, unknown>[] | null;
    }>((resolve) => {
      resolvePromise = resolve;
    });
    let foundConversations = false;

    // Configure unzipper to handle files
    unzipper.onfile = (file) => {
      if (file.name === 'conversations.json') {
        foundConversations = true;
        const parser = clarinet.parser();
        const stack: any[] = [];
        let records: Record<string, unknown>[] = [];
        let currentKey: string | null = null;
        let inPartsArray = false;

        // Set up streaming decompression
        file.ondata = (err, data, final) => {
          if (err) {
            console.error('Decompression error:', err);
            resolvePromise({ success: false, conversations: null });
            return;
          }
          const text = new TextDecoder().decode(data);
          parser.write(text);
          if (final) {
            parser.close();
            if (!processAll && records.length > 0) {
              processChunk(records);
            }
            resolvePromise({
              success: true,
              conversations: processAll ? records : null,
            });
          }
        };

        // Clarinet parser event handlers
        parser.onopenarray = () => {
          const parent = stack[stack.length - 1];
          const arr: any[] = [];
          if (Array.isArray(parent)) {
            parent.push(arr);
          } else if (currentKey) {
            if (currentKey === 'parts') inPartsArray = true;
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
          const obj = {};
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
            if (records.length >= chunkSize && !processAll) {
              processChunk(records);
              records = [];
            }
          }
        };

        parser.onerror = (e) => {
          console.error('JSON parsing error:', e);
          resolvePromise({ success: false, conversations: null });
        };

        // Start decompression
        file.start();
      }
      // Implicitly skip other files by not setting ondata
    };

    // Stream the ZIP file
    const reader = file.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        unzipper.push(new Uint8Array(0), true); // Signal end
        if (!foundConversations) {
          resolvePromise({ success: false, conversations: null });
        }
        break;
      }
      unzipper.push(value, false);
    }

    return promise;
  } catch (error) {
    console.error('Error processing ZIP file:', error);
    return { success: false, conversations: null };
  }
}
