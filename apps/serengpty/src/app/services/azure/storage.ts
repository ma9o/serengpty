 
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { env } from '../../constants/environment';

const accountName = env.AZURE_STORAGE_ACCOUNT_NAME!;
const accountKey = env.AZURE_STORAGE_ACCOUNT_KEY!;
export const azureStorageCredentials = new StorageSharedKeyCredential(
  accountName,
  accountKey
);
const azureBlobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  azureStorageCredentials
);

export const azureInputContainerName = 'enclaveid-production-bucket';

export const azureContainerClient = azureBlobServiceClient.getContainerClient(
  azureInputContainerName
);
