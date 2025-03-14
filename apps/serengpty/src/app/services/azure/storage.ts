import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  ContainerClient,
} from '@azure/storage-blob';
import { env } from '../../constants/environment';

const globalForAzureStorage = globalThis as unknown as {
  azureContainerClient: ContainerClient | undefined;
  azureBlobServiceClient: BlobServiceClient | undefined;
};

export function getAzureContainerClient() {
  if (!env.AZURE_STORAGE_ACCOUNT_NAME || !env.AZURE_STORAGE_ACCOUNT_KEY) {
    throw new Error('Azure storage account name or key is not set');
  }

  if (!globalForAzureStorage.azureBlobServiceClient) {
    globalForAzureStorage.azureBlobServiceClient = new BlobServiceClient(
      `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
      new StorageSharedKeyCredential(
        env.AZURE_STORAGE_ACCOUNT_NAME,
        env.AZURE_STORAGE_ACCOUNT_KEY
      )
    );
  }

  if (!globalForAzureStorage.azureContainerClient) {
    globalForAzureStorage.azureContainerClient =
      globalForAzureStorage.azureBlobServiceClient.getContainerClient(
        'enclaveid-production-bucket'
      );
  }

  return globalForAzureStorage.azureContainerClient;
}
