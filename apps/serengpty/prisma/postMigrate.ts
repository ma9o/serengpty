import { PrismaClient } from '@prisma/client';

// Create HNSW indexes for all vector embedding fields
// const createHnsw = async (prisma: PrismaClient) => {
//   await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS causal_graph_node_embedding_idx ON "CausalGraphNode" USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64)`;
//   await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS raw_data_chunk_embedding_idx ON "RawDataChunk" USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64)`;
// };

// Seed the database with some test data
const seed = async (prisma: PrismaClient) => {
  await prisma.user.create({
    data: {
      id: 'cm0i27jdj0000aqpa73ghpcxf',
      email: 'magogagiovanni@gmail.com',
      name: 'Giovanni',
    },
  });

  await prisma.user.create({
    data: {
      email: 'changeme@gmail.com',
      name: 'Estela',
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
