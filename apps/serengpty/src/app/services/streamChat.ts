import { StreamChatService } from '@enclaveid/shared-utils';

let streamChatService: StreamChatService;

export async function getStreamChatService() {
  if (!streamChatService) {
    streamChatService = new StreamChatService({
      apiKey: process.env.VITE_STREAM_CHAT_API_KEY!,
      apiSecret: process.env.STREAM_CHAT_API_SECRET!,
    });
  }
  return streamChatService;
}
