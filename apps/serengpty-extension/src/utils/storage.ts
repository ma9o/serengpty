export interface UserData {
  userId: string;
  name: string;
}

const userDataStorage = storage.defineItem<UserData>('local:userData', {
  userId: null,
  name: null,
});

export async function getUserData(): Promise<UserData> {
  return await userDataStorage.getValue();
}

export async function saveUserData(userData: UserData): Promise<void> {
  await userDataStorage.setValue(userData);
}

export async function hasUserData(): Promise<boolean> {
  const data = await userDataStorage.getValue();
  return data.userId !== null && data.name !== null;
}
