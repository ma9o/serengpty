import { parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

export async function readParquet(
  fileBuffer: Buffer
): Promise<Record<string, unknown>[]> {
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );
  return new Promise((resolve) => {
    parquetRead({
      file: arrayBuffer,
      compressors,
      rowFormat: 'object',
      onComplete: (rows) => {
        resolve(rows as unknown as Record<string, unknown>[]);
      },
    });
  });
}
