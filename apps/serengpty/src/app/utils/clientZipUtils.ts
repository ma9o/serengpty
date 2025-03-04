'use client';

import JSZip from 'jszip';

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

// Regular expression to match email addresses.
const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Regular expression to match a variety of phone numbers.
const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g;

/**
 * Cleans a single string by redacting emails, phone numbers,
 * and redacting the entire string if its entropy is higher than a threshold.
 * @param text the input text.
 * @returns the cleaned text.
 */
function cleanText(text: string): string {
  // Redact emails and phone numbers.
  const cleaned = text
    .replace(emailRegex, '[redacted email]')
    .replace(phoneRegex, '[redacted phone]');
  // If the text is long and has high entropy, redact the entire string.
  if (cleaned.length > 20 && getShannonEntropy(cleaned) > 4.5) {
    return '[redacted high entropy]';
  }
  return cleaned;
}

/**
 * Recursively cleans all string values within the JSON data.
 * @param data the input data (could be string, array or object)
 * @returns the data after processing string values.
 */
function cleanData<T>(data: T): T {
  if (typeof data === 'string') {
    return cleanText(data) as unknown as T;
  } else if (Array.isArray(data)) {
    return data.map((item) => cleanData(item)) as unknown as T;
  } else if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in data) {
      result[key] = cleanData((data as Record<string, unknown>)[key]);
    }
    return result as unknown as T;
  }
  return data;
}

/**
 * Processes a zip file on the client side and extracts and cleans conversations.json
 * @param file the uploaded ZIP file
 * @returns Promise with cleaned conversations data or null if error
 */
export async function processZipFile(file: File): Promise<{ success: boolean; conversations: Record<string, unknown> | null }> {
  try {
    // Load the zip file
    const zip = new JSZip();
    const content = await zip.loadAsync(file);
    
    // Get the conversations.json file
    const conversationsFile = content.file('conversations.json');
    if (!conversationsFile) {
      return { success: false, conversations: null };
    }
    
    // Read and parse the file
    const jsonString = await conversationsFile.async('string');
    const jsonData = JSON.parse(jsonString);
    
    // Clean the data
    const cleanedJson = cleanData(jsonData);
    
    return { success: true, conversations: cleanedJson };
  } catch (error) {
    console.error('Error processing zip file:', error);
    return { success: false, conversations: null };
  }
}