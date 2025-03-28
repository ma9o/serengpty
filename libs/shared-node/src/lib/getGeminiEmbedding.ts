import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';

const apiEndpoint = 'us-central1-aiplatform.googleapis.com';
const location = 'us-central1';
const project = 'enclaveid';
const model = 'text-embedding-large-exp-03-07';
const endpoint = `projects/${project}/locations/${location}/publishers/google/models/${model}`;
const task = 'SEMANTIC_SIMILARITY';
const outputDimensionality = 3072;

export async function getGeminiEmbedding(content: string): Promise<number[]> {
  const request = {
    endpoint,
    instances: [helpers.toValue({ content: content, task_type: task })!],
    parameters: helpers.toValue({ outputDimensionality }),
  };

  // Escape \n in the service account JSON
  const escapedJson = process.env['GOOGLE_SERVICE_ACCOUNT_JSON']!.replace(
    /\n/g,
    '\\n'
  );
  const credentials = JSON.parse(escapedJson);

  const client = new PredictionServiceClient({ apiEndpoint, credentials });

  const [response] = await client.predict(request);

  const prediction = response.predictions?.[0];

  if (!prediction) {
    throw new Error('No prediction found');
  }

  const embeddingsProto = prediction.structValue?.fields?.['embeddings'];
  const valuesProto = embeddingsProto?.structValue?.fields?.['values'];

  const embedding = valuesProto?.listValue?.values?.map((v) => v.numberValue);

  if (!embedding || embedding.some((v) => v === null || v === undefined)) {
    throw new Error('Error generating embedding');
  }

  return embedding as number[];
}
