import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Create HNSW indexes for all vector embedding fields
// const createHnsw = async (prisma: PrismaClient) => {
//   await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS causal_graph_node_embedding_idx ON "CausalGraphNode" USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64)`;
//   await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS raw_data_chunk_embedding_idx ON "RawDataChunk" USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64)`;
// };

// Seed the database with some test data
const seed = async (prisma: PrismaClient) => {
  // Create users
  const giovanni = await prisma.user.upsert({
    where: { id: 'cm0i27jdj0000aqpa73ghpcxf' },
    update: {},
    create: {
      id: 'cm0i27jdj0000aqpa73ghpcxf',
      name: 'giovanni',
      country: 'Italy',
      passwordHash: await bcrypt.hash('securePassword123', 10),
    },
  });

  const alice = await prisma.user.upsert({
    where: { name: 'alice' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'alice',
      country: 'USA',
    },
  });

  const bob = await prisma.user.upsert({
    where: { name: 'bob' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'bob',
      country: 'UK',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { name: 'charlie' },
    update: {},
    create: {
      email: 'charlie@example.com',
      name: 'charlie',
      country: 'Canada',
    },
  });

  const diana = await prisma.user.upsert({
    where: { name: 'diana' },
    update: {},
    create: {
      email: 'diana@example.com',
      name: 'diana',
      country: 'France',
    },
  });

  // Create serendipitous paths
  const techPath = await prisma.serendipitousPath.create({
    data: {
      summary: 'Connected through tech interests and programming languages',
    },
  });

  const travelPath = await prisma.serendipitousPath.create({
    data: {
      summary: 'Connected through travel experiences in similar locations',
    },
  });

  const foodPath = await prisma.serendipitousPath.create({
    data: {
      summary: 'Connected through culinary interests and favorite restaurants',
    },
  });

  const musicPath = await prisma.serendipitousPath.create({
    data: {
      summary: 'Connected through music tastes and concert experiences',
    },
  });

  // Create common conversations
  const techConversation1 = await prisma.conversation.create({
    data: {
      summary: 'Discussion about TypeScript and React',
      datetime: new Date('2024-02-15T14:30:00Z'),
    },
  });

  const techConversation2 = await prisma.conversation.create({
    data: {
      summary: 'Talking about backend technologies',
      datetime: new Date('2024-02-16T10:15:00Z'),
    },
  });

  const travelConversation1 = await prisma.conversation.create({
    data: {
      summary: 'Experiences in Southeast Asia',
      datetime: new Date('2024-01-20T16:45:00Z'),
    },
  });

  const travelConversation2 = await prisma.conversation.create({
    data: {
      summary: 'European city recommendations',
      datetime: new Date('2024-01-25T09:30:00Z'),
    },
  });

  const foodConversation = await prisma.conversation.create({
    data: {
      summary: 'Favorite Italian dishes',
      datetime: new Date('2024-02-05T19:20:00Z'),
    },
  });

  const musicConversation = await prisma.conversation.create({
    data: {
      summary: 'Jazz and classical music preferences',
      datetime: new Date('2024-02-10T20:45:00Z'),
    },
  });

  // Create unique conversations
  const gioUniqueConvo = await prisma.conversation.create({
    data: {
      summary: 'Machine learning projects',
      datetime: new Date('2024-02-12T11:30:00Z'),
    },
  });

  const aliceUniqueConvo = await prisma.conversation.create({
    data: {
      summary: 'Frontend design patterns',
      datetime: new Date('2024-02-13T14:20:00Z'),
    },
  });

  const bobUniqueConvo = await prisma.conversation.create({
    data: {
      summary: 'DevOps and CI/CD pipelines',
      datetime: new Date('2024-02-14T09:45:00Z'),
    },
  });

  const charlieUniqueConvo = await prisma.conversation.create({
    data: {
      summary: 'Backpacking in New Zealand',
      datetime: new Date('2024-01-18T16:30:00Z'),
    },
  });

  const dianaUniqueConvo = await prisma.conversation.create({
    data: {
      summary: 'Wine tasting experiences',
      datetime: new Date('2024-02-03T17:15:00Z'),
    },
  });

  // Connect users to paths and conversations
  // Giovanni and Alice - Tech Path
  await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: techPath.id,
      commonConversations: {
        connect: [{ id: techConversation1.id }, { id: techConversation2.id }],
      },
      uniqueConversations: {
        connect: [{ id: gioUniqueConvo.id }],
      },
    },
  });

  await prisma.userPath.create({
    data: {
      userId: alice.id,
      pathId: techPath.id,
      commonConversations: {
        connect: [{ id: techConversation1.id }, { id: techConversation2.id }],
      },
      uniqueConversations: {
        connect: [{ id: aliceUniqueConvo.id }],
      },
    },
  });

  // Giovanni and Charlie - Travel Path
  await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: travelPath.id,
      commonConversations: {
        connect: [
          { id: travelConversation1.id },
          { id: travelConversation2.id },
        ],
      },
      uniqueConversations: {
        connect: [{ id: gioUniqueConvo.id }],
      },
    },
  });

  await prisma.userPath.create({
    data: {
      userId: charlie.id,
      pathId: travelPath.id,
      commonConversations: {
        connect: [
          { id: travelConversation1.id },
          { id: travelConversation2.id },
        ],
      },
      uniqueConversations: {
        connect: [{ id: charlieUniqueConvo.id }],
      },
    },
  });

  // Giovanni and Bob - Food Path
  await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: foodPath.id,
      commonConversations: {
        connect: [{ id: foodConversation.id }],
      },
      uniqueConversations: {
        connect: [{ id: gioUniqueConvo.id }],
      },
    },
  });

  await prisma.userPath.create({
    data: {
      userId: bob.id,
      pathId: foodPath.id,
      commonConversations: {
        connect: [{ id: foodConversation.id }],
      },
      uniqueConversations: {
        connect: [{ id: bobUniqueConvo.id }],
      },
    },
  });

  // Giovanni and Diana - Music Path
  await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: musicPath.id,
      commonConversations: {
        connect: [{ id: musicConversation.id }],
      },
      uniqueConversations: {
        connect: [{ id: gioUniqueConvo.id }],
      },
    },
  });

  await prisma.userPath.create({
    data: {
      userId: diana.id,
      pathId: musicPath.id,
      commonConversations: {
        connect: [{ id: musicConversation.id }],
      },
      uniqueConversations: {
        connect: [{ id: dianaUniqueConvo.id }],
      },
    },
  });
};

// Execute the script
(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    // console.log('Creating HNSW indexes...');
    // await createHnsw(prisma);

    console.log('Seeding database...');
    await seed(prisma);

    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
