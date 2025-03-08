'use client';

import { Unzip, UnzipInflate } from 'fflate';
import clarinet from 'clarinet';


/**
 * Calculates the Shannon entropy of a string.
 * @param s the input string.
 * @returns the entropy in bits.
 */
function getShannonEntropy(s: string): number {
  console.log(`Calculating entropy for string of length: ${s.length}`);
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
  console.log(`Entropy calculated: ${entropy}`);
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
  console.log(`Cleaning text of length: ${text.length}`);
  const cleaned = text
    .replace(emailRegex, '[redacted email]')
    .replace(phoneRegex, '[redacted phone]');
  if (cleaned.length > 20 && getShannonEntropy(cleaned) > 4.5) {
    console.log('High entropy detected, redacting');
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
  // Optionally, implement custom logic here (e.g., an API call)
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
  console.log(
    `Starting to process ZIP file: ${file.name}, size: ${file.size}, chunkSize: ${chunkSize}, processAll: ${processAll}`
  );
  let resolvePromise: (value: {
    success: boolean;
    conversations: Record<string, unknown>[] | null;
  }) => void;
  let resolved = false;
  const doResolve = (value: {
    success: boolean;
    conversations: Record<string, unknown>[] | null;
  }) => {
    console.log(
      `Resolving promise with success: ${value.success}, records: ${
        value.conversations ? value.conversations.length : 'null'
      }`
    );
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

    // Configure unzipper to handle files within the ZIP
    unzipper.onfile = (unzippedFile) => {
      console.log(
        `Found file in ZIP: ${unzippedFile.name}, size: ${unzippedFile.size}`
      );
      // We only care about 'conversations.json'
      if (unzippedFile.name === 'conversations.json') {
        console.log('Found conversations.json, processing...');
        foundConversations = true;

        const parser = clarinet.parser();
        const stack: any[] = [];
        let records: Record<string, unknown>[] = [];
        let currentKey: string | null = null;
        let inPartsArray = false;

        // Set up streaming decompression
        unzippedFile.ondata = (err, data, final) => {
          if (err) {
            console.error('Decompression error:', err);
            doResolve({ success: false, conversations: null });
            return;
          }

          console.log(
            `Received data chunk: ${data.length} bytes, final: ${final}`
          );
          // Convert chunk to text for clarinet
          const text = new TextDecoder().decode(data);
          parser.write(text);

          if (final) {
            console.log('Final chunk received, closing parser');
            // End of this file entry
            parser.close();
            if (!processAll && records.length > 0) {
              console.log(
                `Processing final chunk of ${records.length} records`
              );
              processChunk(records);
            }
            doResolve({
              success: true,
              conversations: processAll ? records : null,
            });
          }
        };

        // JSON parser event handlers
        parser.onopenarray = () => {
          console.log('JSON parser: opening array');
          const parent = stack[stack.length - 1];
          const arr: any[] = [];
          if (Array.isArray(parent)) {
            parent.push(arr);
          } else if (currentKey) {
            // Check if the array is in the 'parts' key
            if (currentKey === 'parts') {
              inPartsArray = true;
            }
            parent[currentKey] = arr;
          }
          stack.push(arr);
        };

        parser.onclosearray = () => {
          console.log('JSON parser: closing array');
          const closedArray = stack.pop();
          // If we're popping the array that was in 'parts', no longer in parts array
          if (
            stack.length > 0 &&
            !Array.isArray(stack[stack.length - 1]) &&
            stack[stack.length - 1]['parts'] === closedArray
          ) {
            inPartsArray = false;
          }
        };

        parser.onopenobject = (key) => {
          console.log(
            `JSON parser: opening object${key ? ' with key: ' + key : ''}`
          );
          const obj: Record<string, unknown> = {};
          if (stack.length === 0) {
            // This is the root object (if JSON is an object at the root)
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
          console.log(`JSON parser: found key: ${key}`);
          currentKey = key;
        };

        parser.onvalue = (value) => {
          console.log(
            `JSON parser: found value${
              typeof value === 'string' ? ' (string)' : ''
            } for key: ${currentKey}, in parts: ${inPartsArray}`
          );
          // If this value is inside the 'parts' array and is a string, clean it
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
          console.log('JSON parser: closing object');
          const obj = stack.pop();
          // If the parent is an array at one level up, assume we finished parsing one record
          if (stack.length > 0 && Array.isArray(stack[stack.length - 1])) {
            records.push(obj);
            console.log(
              `Added record to batch, current batch size: ${records.length}`
            );
            if (records.length >= chunkSize && !processAll) {
              console.log(
                `Reached chunk size limit (${chunkSize}), processing chunk`
              );
              processChunk(records);
              records = [];
            }
          }
        };

        parser.onerror = (e) => {
          console.error('JSON parsing error:', e);
          doResolve({ success: false, conversations: null });
        };

        // Start reading this file entry
        console.log('Starting to read conversations.json');
        unzippedFile.start();
      }
    };

    // Now stream the ZIP file itself from the File object
    console.log('Starting to stream ZIP file');
    const reader = file.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Finished reading file stream');
        // Signal the unzipper that the stream is finished
        unzipper.push(new Uint8Array(0), true);

        // If we never found 'conversations.json', resolve with failure
        if (!foundConversations) {
          console.log('Error: conversations.json not found in ZIP');
          doResolve({ success: false, conversations: null });
        }
        break;
      }
      if (value) {
        console.log(`Pushing ${value.length} bytes to unzipper`);
        unzipper.push(value, false);
      }
    }
  } catch (error) {
    console.error('Error processing ZIP file:', error);
    doResolve({ success: false, conversations: null });
  }

  return promise;
}
