interface UserCredentials {
  name: string;
  password: string;
}

// Update this to your actual API base URL
const API_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://api';

export const authService = {
  async login(credentials: UserCredentials): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Login failed';
        console.error('Login error:', errorMessage);
        throw new Error(errorMessage);
      }

      if (!data.apiToken) {
        throw new Error('No API token received');
      }

      // Store authentication data
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

      await storage.setItems([
        { key: 'local:apiToken', value: data.apiToken },
        { key: 'local:tokenExpiry', value: expiryDate.toISOString() },
        { key: 'local:username', value: credentials.name },
      ]);

      return data.apiToken;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred during login');
    }
  },

  async signup(credentials: UserCredentials): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract specific error messages if available
        const errorMessage =
          data.error ||
          (data.issues && data.issues[0]?.message) ||
          'Signup failed';
        console.error('Signup error:', errorMessage);
        throw new Error(errorMessage);
      }

      if (!data.apiToken) {
        throw new Error('No API token received');
      }

      // Store authentication data
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry

      await storage.setItems([
        { key: 'local:apiToken', value: data.apiToken },
        { key: 'local:tokenExpiry', value: expiryDate.toISOString() },
        { key: 'local:username', value: credentials.name },
      ]);

      return data.apiToken;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred during signup');
    }
  },

  async logout(): Promise<void> {
    await storage.removeItems([
      'local:apiToken',
      'local:tokenExpiry',
      'local:username',
    ]);
  },

  async getAuthToken(): Promise<string | null> {
    const [token, expiry] = await Promise.all([
      storage.getItem<string>('local:apiToken'),
      storage.getItem<string>('local:tokenExpiry'),
    ]);

    if (!token || !expiry) {
      return null;
    }

    const expiryDate = new Date(expiry);
    if (expiryDate <= new Date()) {
      // Token has expired
      await this.logout();
      return null;
    }

    return token;
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    return !!token;
  },

  async getUsername(): Promise<string | null> {
    return storage.getItem<string>('local:username');
  },
};
