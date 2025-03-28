export async function readParquet(
  fileBuffer: Buffer
): Promise<Record<string, unknown>[]> {
  // Need to do this for azure-functions
  const parquetRead = require('hyparquet').parquetRead;
  const compressors = require('hyparquet-compressors').compressors;

  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );
  return new Promise((resolve) => {
    parquetRead({
      file: arrayBuffer,
      compressors,
      rowFormat: 'object',
      onComplete: (rows: any[]) => {
        resolve(rows as unknown as Record<string, unknown>[]);
      },
    });
  });
}
