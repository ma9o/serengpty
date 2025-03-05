import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StreamChat } from 'stream-chat';

const streamChatClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
  process.env.STREAM_CHAT_API_SECRET
);

// Seed the database with some test data
const seed = async (prisma: PrismaClient) => {
  // Create users
  const giovanni = await prisma.user.upsert({
    where: { id: 'ma9o' },
    update: {},
    create: {
      id: 'ma9o',
      name: 'giovanni',
      country: 'IT', // Italy - Using ISO country code
      passwordHash: await bcrypt.hash('securePassword1', 10),
    },
  });

  const alice = await prisma.user.upsert({
    where: { name: 'alice' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'alice',
      country: 'US', // USA - Using ISO country code
      passwordHash: await bcrypt.hash('securePassword2', 10),
    },
  });

  const bob = await prisma.user.upsert({
    where: { name: 'bob' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'bob',
      country: 'GB', // UK - Using ISO country code (Great Britain)
      passwordHash: await bcrypt.hash('securePassword3', 10),
    },
  });

  const charlie = await prisma.user.upsert({
    where: { name: 'charlie' },
    update: {},
    create: {
      email: 'charlie@example.com',
      name: 'charlie',
      country: 'CA', // Canada - Using ISO country code
      passwordHash: await bcrypt.hash('securePassword4', 10),
    },
  });

  const diana = await prisma.user.upsert({
    where: { name: 'diana' },
    update: {},
    create: {
      email: 'diana@example.com',
      name: 'diana',
      country: 'FR', // France - Using ISO country code
      passwordHash: await bcrypt.hash('securePassword5', 10),
    },
  });

  // Create user matches first
  const gioAliceMatch = await prisma.usersMatch.create({
    data: {
      score: 0.85,
      users: {
        connect: [{ id: giovanni.id }, { id: alice.id }],
      },
    },
  });

  const gioCharlieMatch = await prisma.usersMatch.create({
    data: {
      score: 0.78,
      users: {
        connect: [{ id: giovanni.id }, { id: charlie.id }],
      },
    },
  });

  const gioBobMatch = await prisma.usersMatch.create({
    data: {
      score: 0.88,
      users: {
        connect: [{ id: giovanni.id }, { id: bob.id }],
      },
    },
  });

  const gioDianaMatch = await prisma.usersMatch.create({
    data: {
      score: 0.81,
      users: {
        connect: [{ id: giovanni.id }, { id: diana.id }],
      },
    },
  });

  // Create serendipitous paths
  const techPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Tech Enthusiasts',
      commonSummary:
        'Connected through tech interests and programming languages',
      usersMatch: {
        connect: { id: gioAliceMatch.id },
      },
    },
  });

  const travelPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Global Explorers',
      commonSummary:
        'Connected through travel experiences in similar locations',
      usersMatch: {
        connect: { id: gioCharlieMatch.id },
      },
    },
  });

  const foodPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Culinary Connoisseurs',
      commonSummary:
        'Connected through culinary interests and favorite restaurants',
      usersMatch: {
        connect: { id: gioBobMatch.id },
      },
    },
  });

  const musicPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Melody Makers',
      commonSummary: 'Connected through music tastes and concert experiences',
      usersMatch: {
        connect: { id: gioDianaMatch.id },
      },
    },
  });

  // Additional paths for testing multiple connections between users
  const gamingPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Gaming Guild',
      commonSummary: 'Connected through gaming interests and strategies',
      usersMatch: {
        connect: { id: gioBobMatch.id },
      },
    },
  });

  const bookClubPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Literary League',
      commonSummary: 'Connected through book recommendations and discussions',
      usersMatch: {
        connect: { id: gioAliceMatch.id },
      },
    },
  });

  const sportPath = await prisma.serendipitousPath.create({
    data: {
      title: 'Active Athletes',
      commonSummary: 'Connected through sports interests and activities',
      usersMatch: {
        connect: { id: gioCharlieMatch.id },
      },
    },
  });

  // Create common conversations
  await prisma.conversation.create({
    data: {
      title: 'TypeScript and React',
      summary: 'Discussion about TypeScript and React',
      datetime: new Date('2024-02-15T14:30:00Z'),
      serendipitousPathId: techPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Backend Technologies',
      summary: 'Talking about backend technologies',
      datetime: new Date('2024-02-16T10:15:00Z'),
      serendipitousPathId: techPath.id,
      userId: alice.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Southeast Asia Travel',
      summary: 'Experiences in Southeast Asia',
      datetime: new Date('2024-01-20T16:45:00Z'),
      serendipitousPathId: travelPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'European Cities',
      summary: 'European city recommendations',
      datetime: new Date('2024-01-25T09:30:00Z'),
      serendipitousPathId: travelPath.id,
      userId: charlie.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Italian Cuisine',
      summary: 'Favorite Italian dishes',
      datetime: new Date('2024-02-05T19:20:00Z'),
      serendipitousPathId: foodPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Music Preferences',
      summary: 'Jazz and classical music preferences',
      datetime: new Date('2024-02-10T20:45:00Z'),
      serendipitousPathId: musicPath.id,
      userId: diana.id, // Adding user relationship
    },
  });

  // Create unique conversations for each UserPath
  // Giovanni and Alice - Tech Path
  const gioAliceTechPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: techPath.id,
      uniqueSummary: "Giovanni's knowledge of machine learning projects",
      uniqueCallToAction:
        'Ask how to optimize the frontend for your ML applications',
    },
  });

  const aliceTechPath = await prisma.userPath.create({
    data: {
      userId: alice.id,
      pathId: techPath.id,
      uniqueSummary: "Alice's expertise in frontend design patterns",
      uniqueCallToAction: 'Ask how ML could enhance your frontend applications',
    },
  });

  // Giovanni and Alice - Book Club Path (second connection)
  const gioAliceBookPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: bookClubPath.id,
      uniqueSummary: "Giovanni's science fiction novel recommendations",
      uniqueCallToAction: 'Ask how to organize a sci-fi book club discussion',
    },
  });

  const aliceBookPath = await prisma.userPath.create({
    data: {
      userId: alice.id,
      pathId: bookClubPath.id,
      uniqueSummary: "Alice's book club organizing skills",
      uniqueCallToAction:
        'Ask for sci-fi recommendations for your next book club',
    },
  });

  // Giovanni and Charlie - Travel Path
  const gioTravelPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: travelPath.id,
      uniqueSummary: "Giovanni's travel algorithms and ML applications",
      uniqueCallToAction:
        'Ask how your ML recommendations would work for backpackers',
    },
  });

  const charlieTravelPath = await prisma.userPath.create({
    data: {
      userId: charlie.id,
      pathId: travelPath.id,
      uniqueSummary: "Charlie's backpacking experiences in New Zealand",
      uniqueCallToAction: 'Ask how ML could optimize your backpacking routes',
    },
  });

  // Giovanni and Charlie - Sport Path (second connection)
  const gioSportPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: sportPath.id,
      uniqueSummary: "Giovanni's marathon training schedule",
      uniqueCallToAction:
        'Ask how mountain biking could complement your endurance training',
    },
  });

  const charlieSportPath = await prisma.userPath.create({
    data: {
      userId: charlie.id,
      pathId: sportPath.id,
      uniqueSummary: "Charlie's mountain biking knowledge",
      uniqueCallToAction:
        'Ask how marathon training principles could improve your biking stamina',
    },
  });

  // Giovanni and Bob - Food Path
  const gioFoodPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: foodPath.id,
      uniqueSummary: "Giovanni's Italian cooking techniques",
      uniqueCallToAction:
        'Ask how to automate repetitive cooking tasks with DevOps principles',
    },
  });

  const bobFoodPath = await prisma.userPath.create({
    data: {
      userId: bob.id,
      pathId: foodPath.id,
      uniqueSummary: "Bob's DevOps knowledge",
      uniqueCallToAction:
        'Ask how Italian cooking techniques could inspire better team workflows',
    },
  });

  // Giovanni and Bob - Gaming Path (second connection)
  const gioGamingPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: gamingPath.id,
      uniqueSummary: "Giovanni's strategy game tournament experience",
      uniqueCallToAction:
        'Ask how game development insights could improve competitive strategy',
    },
  });

  const bobGamingPath = await prisma.userPath.create({
    data: {
      userId: bob.id,
      pathId: gamingPath.id,
      uniqueSummary: "Bob's game development framework knowledge",
      uniqueCallToAction:
        'Ask how competitive gaming strategies influence game design',
    },
  });

  // Giovanni and Diana - Music Path
  const gioMusicPath = await prisma.userPath.create({
    data: {
      userId: giovanni.id,
      pathId: musicPath.id,
      uniqueSummary: "Giovanni's classical composers analysis",
      uniqueCallToAction:
        'Ask which wines pair best with specific classical compositions',
    },
  });

  const dianaMusicPath = await prisma.userPath.create({
    data: {
      userId: diana.id,
      pathId: musicPath.id,
      uniqueSummary: "Diana's wine tasting experiences",
      uniqueCallToAction:
        'Ask which classical pieces enhance different wine tasting experiences',
    },
  });

  // Create unique conversations for each user path
  await prisma.conversation.create({
    data: {
      title: 'Machine Learning Projects',
      summary: 'Machine learning projects',
      datetime: new Date('2024-02-12T11:30:00Z'),
      userPathId: gioAliceTechPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Frontend Design Patterns',
      summary: 'Frontend design patterns',
      datetime: new Date('2024-02-13T14:20:00Z'),
      userPathId: aliceTechPath.id,
      userId: alice.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Travel Algorithms and ML',
      summary: 'Travel algorithms and ML',
      datetime: new Date('2024-01-19T15:30:00Z'),
      userPathId: gioTravelPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Backpacking in New Zealand',
      summary: 'Backpacking in New Zealand',
      datetime: new Date('2024-01-18T16:30:00Z'),
      userPathId: charlieTravelPath.id,
      userId: charlie.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Italian Cooking Techniques',
      summary: 'Italian cooking techniques',
      datetime: new Date('2024-02-04T18:10:00Z'),
      userPathId: gioFoodPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'DevOps and CI/CD',
      summary: 'DevOps and CI/CD pipelines',
      datetime: new Date('2024-02-14T09:45:00Z'),
      userPathId: bobFoodPath.id,
      userId: bob.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Classical Composers',
      summary: 'Classical composers analysis',
      datetime: new Date('2024-02-11T21:00:00Z'),
      userPathId: gioMusicPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Wine Tasting',
      summary: 'Wine tasting experiences',
      datetime: new Date('2024-02-03T17:15:00Z'),
      userPathId: dianaMusicPath.id,
      userId: diana.id, // Adding user relationship
    },
  });

  // Create unique conversations for the new paths
  // Book Club Path - Alice and Giovanni
  await prisma.conversation.create({
    data: {
      title: 'Science Fiction Novels',
      summary: 'Science fiction novel recommendations',
      datetime: new Date('2024-02-20T13:45:00Z'),
      userPathId: gioAliceBookPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Book Club Organization',
      summary: 'Book club organizing skills',
      datetime: new Date('2024-02-21T16:30:00Z'),
      userPathId: aliceBookPath.id,
      userId: alice.id, // Adding user relationship
    },
  });

  // Sport Path - Charlie and Giovanni
  await prisma.conversation.create({
    data: {
      title: 'Marathon Training',
      summary: 'Marathon training schedule',
      datetime: new Date('2024-01-28T08:15:00Z'),
      userPathId: gioSportPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Mountain Biking',
      summary: 'Mountain biking trails',
      datetime: new Date('2024-01-29T09:45:00Z'),
      userPathId: charlieSportPath.id,
      userId: charlie.id, // Adding user relationship
    },
  });

  // Gaming Path - Bob and Giovanni
  await prisma.conversation.create({
    data: {
      title: 'Strategy Game Tournament',
      summary: 'Strategy game tournament',
      datetime: new Date('2024-02-07T20:30:00Z'),
      userPathId: gioGamingPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Game Development',
      summary: 'Game development frameworks',
      datetime: new Date('2024-02-08T19:15:00Z'),
      userPathId: bobGamingPath.id,
      userId: bob.id, // Adding user relationship
    },
  });

  // Add common conversations for the new paths
  await prisma.conversation.create({
    data: {
      title: 'Literary Podcasts',
      summary: 'Literary podcasts and analysis',
      datetime: new Date('2024-02-19T14:30:00Z'),
      serendipitousPathId: bookClubPath.id,
      userId: giovanni.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Sports Analytics',
      summary: 'Sports analytics and statistics',
      datetime: new Date('2024-01-27T10:15:00Z'),
      serendipitousPathId: sportPath.id,
      userId: charlie.id, // Adding user relationship
    },
  });

  await prisma.conversation.create({
    data: {
      title: 'Multiplayer Gaming',
      summary: 'Multiplayer game coordination',
      datetime: new Date('2024-02-06T21:00:00Z'),
      serendipitousPathId: gamingPath.id,
      userId: bob.id, // Adding user relationship
    },
  });

  // Return all user IDs
  return [giovanni, alice, bob, charlie, diana];
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
    console.log('Seeding database...');
    const users = await seed(prisma);

    // console.log('Deleting Stream Chat users...');
    // const streamChatUsers = await streamChatClient.queryUsers({
    //   id: { $nin: ['ma9o'] },
    // });

    // if (streamChatUsers.users.length > 0) {
    //   await streamChatClient.deleteUsers(
    //     streamChatUsers.users.map((user) => user.id),
    //     { conversations: 'hard' }
    //   );
    // }

    // console.log('Creating Stream Chat users...');
    // await streamChatClient.upsertUsers(
    //   users.map((user) => ({
    //     id: user.id,
    //     role: 'user',
    //     name: user.name,
    //   }))
    // );

    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
