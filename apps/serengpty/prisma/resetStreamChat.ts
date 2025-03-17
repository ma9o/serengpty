import { StreamChat } from 'stream-chat';

async function main() {
  console.log('🔄 Starting reset process for Stream Chat users...');

  // Load environment variables
  const streamKey = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY;
  const streamSecret = process.env.STREAM_CHAT_API_SECRET;

  if (!streamKey || !streamSecret) {
    console.error('❌ Stream Chat API credentials are missing');
    process.exit(1);
  }

  // Initialize Stream Chat client
  const streamClient = StreamChat.getInstance(streamKey, streamSecret);

  // In case you fuck up...
  // await streamClient.restoreUsers(['ma9o']);

  try {
    console.log('🔍 Querying Stream Chat users...');

    // Query Stream Chat for all users (except any you want to keep)
    const streamChatUsers = await streamClient.queryUsers({
      id: { $nin: ['ma9o'] },
    });

    console.log(
      `🔍 Found ${streamChatUsers.users.length} users in Stream Chat`
    );

    if (streamChatUsers.users.length > 0) {
      // Extract user IDs
      const userIds = streamChatUsers.users.map((user) => user.id);
      console.log(`🧹 Removing ${userIds.length} Stream Chat users...`);

      // Bulk delete users with hard delete option (completely removes users and their data)
      const taskId = await streamClient
        .deleteUsers(userIds, {
          conversations: 'hard', // Also delete all channels/conversations
          messages: 'hard',
        })
        .then((res) => {
          return res.task_id;
        });

      const status = await streamClient.getTask(taskId);

      console.log(status);

      console.log('✅ Successfully reset all Stream Chat users');
    } else {
      console.log('ℹ️ No Stream Chat users found to reset');
    }
  } catch (error) {
    console.error('❌ An error occurred during the reset process:', error);
  } finally {
    console.log('🏁 Reset process completed');
  }
}

main().catch((e) => {
  console.error('❌ Script execution failed:', e);
  process.exit(1);
});
