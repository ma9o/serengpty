export interface UserData {
  userId: string;
  name: string;
}

const userDataStorage = storage.defineItem<UserData>('local:userData');

export async function getUserData(): Promise<UserData | null> {
  return await userDataStorage.getValue();
}

export async function saveUserData(userData: UserData): Promise<void> {
  await userDataStorage.setValue(userData);
}

export async function hasUserData(): Promise<boolean> {
  return (await getUserData()) !== null;
}
