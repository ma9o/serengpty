export interface UserData {
  userId: string;
  name: string;
}

export const userDataStorage = storage.defineItem<UserData>('local:userData');

export interface UserPreferences {
  doNotAskAgain: boolean;
}

export const userPreferencesStorage = storage.defineItem<UserPreferences>(
  'local:userPreferences'
);
