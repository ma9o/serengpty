// Using environment variable or default to localhost during development
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Ensure the URL doesn't end with a trailing slash
function formatApiUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function signUp() {
  try {
    const response = await fetch(`${formatApiUrl(API_BASE_URL)}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Signup failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error during signup:', error);
    throw error;
  }
}
