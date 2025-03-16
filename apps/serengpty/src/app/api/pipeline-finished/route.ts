// DEPRECATED

import { NextRequest, NextResponse } from 'next/server';
import { loadPipelineResults } from '../../services/azure/loadPipelineResult';
import { readParquet } from '../../services/readParquet';
import {
  savePipelineResults,
  SerendipityOptimizedRow,
  UserSimilaritiesRow,
  ConversationPairClusterRow,
} from '../../services/db/savePipelineResults';
import { env } from '../../constants/environment';

export async function POST(request: NextRequest) {
  try {
    const { userId, secret } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId and secret are required' },
        { status: 400 }
      );
    }

    if (!env.IS_DEVELOPMENT) {
      if (secret !== env.PIPELINE_SECRET) {
        return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
      }
    }

    const blobNames = [
      `/dagster/serendipity_optimized/${userId}.snappy`,
      `/dagster/user_similarities/${userId}.snappy`,
      `/dagster/conversation_pair_clusters/${userId}.snappy`,
    ];

    const [serendipityOptimized, userSimilarities, conversationPairClusters] =
      await Promise.all(
        blobNames.map(async (blobName) => {
          const data = await loadPipelineResults(blobName);
          return await readParquet(data);
        })
      );

    await savePipelineResults(
      userId,
      serendipityOptimized as unknown as SerendipityOptimizedRow[],
      userSimilarities as unknown as UserSimilaritiesRow[],
      conversationPairClusters as unknown as ConversationPairClusterRow[]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error: ' + error },
      { status: 500 }
    );
  }
}
