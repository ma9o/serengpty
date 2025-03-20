interface UserCredentials {
  name: string;
  password: string;
}

// Update this to your actual API base URL
const API_BASE_URL = 'https://api.serengpty.com';

export const authService = {
  async login(credentials: UserCredentials): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
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
  },

  async signup(credentials: UserCredentials): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
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
