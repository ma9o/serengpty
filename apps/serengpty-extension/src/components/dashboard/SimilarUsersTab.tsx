import { useEffect, useState, useCallback } from 'react';
import { useConversation } from '../../providers';
import { Card, CardContent } from '@enclaveid/ui';
import { ChatButton } from '@enclaveid/ui/stream-chat/chat-button';
import { getIdenticon } from '@enclaveid/shared-utils';
import { ScoreCircle } from '@enclaveid/ui/score-circle';
import { RefreshCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { SummaryButton } from '../SummaryButton';
import Markdown from 'react-markdown';

export function SimilarUsersTab({
  onChatButtonClick,
}: {
  onChatButtonClick: (channelId: string) => void;
}) {
  const {
    conversationId,
    title,
    messages,
    isLoading,
    similarUsers,
    contentHash,
    processingMetadata,
    processConversation,
  } = useConversation();

  // Add state to track completions and open accordions
  const [completions, setCompletions] = useState<Record<string, string>>({});
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(
    {}
  );

  // Toggle accordion function
  const toggleAccordion = (convId: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [convId]: !prev[convId],
    }));
  };

  // Create a stable completion handler with useCallback
  const handleCompletion = useCallback(
    (conversationId: string, completion: string) => {
      setCompletions((prev) => ({
        ...prev,
        [conversationId]: completion,
      }));

      // Auto-open accordion when summary starts streaming
      // Use functional update to avoid needing the openAccordions dependency
      setOpenAccordions((prev) => {
        // Only update if not already open
        if (!prev[conversationId]) {
          return {
            ...prev,
            [conversationId]: true,
          };
        }
        return prev;
      });
    },
    [] // No dependencies needed with functional updates
  );

  // Process conversation automatically with content-aware processing
  useEffect(() => {
    // Basic conditions to skip processing
    if (!conversationId || messages.length === 0) {
      return;
    }

    // Skip if already loading
    if (isLoading) {
      return;
    }

    // Check if content has changed since last processing
    const contentChanged = contentHash !== processingMetadata.lastProcessedHash;

    // Check only if the content has changed, not whether we have results
    // This ensures we don't reprocess content that had no similar users
    if (!contentChanged) {
      console.log('Content unchanged, skipping processing');
      return;
    }

    // Check if last message is from the assistant (complete exchange)
    const lastMessageIsAssistant =
      messages[messages.length - 1]?.role === 'assistant';
    if (!lastMessageIsAssistant) {
      console.log('Last message not from assistant, waiting for completion');
      return;
    }

    // Determine if this is initial processing or an update
    const isInitialProcessing = !processingMetadata.lastProcessedHash;

    // Use 0ms timeout for initial processing, 1000ms debounce for updates
    const debounceTime = isInitialProcessing ? 0 : 1000;

    const processingTimeout = setTimeout(() => {
      console.log(
        `Processing conversation with ${
          contentChanged ? 'changed' : 'new'
        } content:`,
        conversationId,
        isInitialProcessing ? '(initial)' : '(update)'
      );
      processConversation(false);
    }, debounceTime); // 0ms for initial, 1 second debounce for updates

    return () => clearTimeout(processingTimeout);
  }, [
    conversationId,
    contentHash,
    messages,
    isLoading,
    similarUsers,
    processingMetadata.lastProcessedHash,
    processConversation,
  ]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="ml-2">Finding similar users...</p>
      </div>
    );
  }

  // No similar users found
  if (similarUsers.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You're quite unique!
          <br />
          No one else thought about this, yet.
          <br />
          Come back later or try another conversation.
        </p>
        <div className="flex flex-row items-center gap-2 w-full justify-center mt-4">
          <RefreshCcw
            className="h-6 w-6 cursor-pointer bg-white border border-gray-200 rounded-md p-1"
            onClick={() => processConversation(true)}
          />
          {processingMetadata.lastProcessedAt && (
            <p className="text-xs text-gray-500">
              Last processed:{' '}
              {processingMetadata.lastProcessedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Group conversations by user
  const userConversations = similarUsers.reduce((acc, userConv) => {
    if (!acc[userConv.userId]) {
      acc[userConv.userId] = {
        userId: userConv.userId,
        userName: userConv.userName,
        conversations: [],
      };
    }
    acc[userConv.userId].conversations.push(userConv);
    return acc;
  }, {} as Record<string, { userId: string; userName: string; conversations: typeof similarUsers }>);

  // Check if any of the similar users meet the threshold
  const hasAboveThresholdMatches = similarUsers.some(
    (user) => user.meetsThreshold
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col justify-between items-center mb-4 px-1 gap-2">
        <div className="w-full">
          <p className="text-md text-gray-500 line-clamp-1">
            Also chatting about:
          </p>
          <h3 className="text-sm font-semibold text-gray-800">
            <span className="font-medium">{title}</span>
          </h3>
        </div>
        <div className="w-full flex flex-row items-center gap-2 justify-start">
          <RefreshCcw
            className="h-6 w-6 cursor-pointer bg-white border border-gray-200 rounded-md p-1"
            onClick={() => processConversation(true)}
          />
          {processingMetadata.lastProcessedAt && (
            <p className="text-xs text-gray-500 text-right">
              Last updated at:{' '}
              {processingMetadata.lastProcessedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {!isLoading && similarUsers.length > 0 && !hasAboveThresholdMatches && (
        <div className="px-4 pb-2 text-sm text-orange-600 text-center border-b mb-3">
          No good matches found.
          <br />
          Closest conversations below threshold:
        </div>
      )}

      <div className="space-y-3">
        {Object.values(userConversations).map((userData) => (
          <Card key={userData.userId} className="overflow-hidden">
            <div className="flex px-6 py-4 items-center border-b gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden">
                <img
                  src={getIdenticon(userData.userName)}
                  alt={userData.userName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="font-medium truncate">{userData.userName}</div>
                <div className="text-xs text-gray-500">
                  {userData.conversations.length} similar conversation
                  {userData.conversations.length !== 1 ? 's' : ''}
                </div>
              </div>
              <ChatButton
                otherUserId={userData.userId}
                otherUserName={userData.userName}
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onError={(error) => console.error('Chat error:', error)}
                onChannelCreated={(channelId) => {
                  onChatButtonClick(channelId);
                }}
              />
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {userData.conversations.map((conversation) => (
                  <div key={conversation.id} className="px-6 py-3">
                    <div className={`flex items-center justify-between gap-2`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {conversation.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Initiated on{' '}
                            {new Date(
                              conversation.createdAt
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-start gap-2 mt-1">
                          <SummaryButton
                            currentConversationId={conversationId || undefined}
                            otherConversationId={conversation.id}
                            setCompletion={(completion) => {
                              handleCompletion(conversation.id, completion);
                            }}
                          />

                          {/* Accordion toggle button */}
                          {completions[conversation.id] && (
                            <button
                              onClick={() => toggleAccordion(conversation.id)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {openAccordions[conversation.id] ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <ScoreCircle
                          percentage={1 - conversation.distance}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Accordion content */}
                    {completions[conversation.id] &&
                      openAccordions[conversation.id] && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm">
                          <Markdown>{completions[conversation.id]}</Markdown>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
