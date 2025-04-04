import { StreamChatService } from '@enclaveid/shared-browser';

let streamChatService: StreamChatService;

export async function getStreamChatService() {
  if (!streamChatService) {
    streamChatService = new StreamChatService({
      apiKey: process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
      apiSecret: process.env.STREAM_CHAT_API_SECRET!,
    });
  }
  return streamChatService;
}
