'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { ScrollArea } from '@enclaveid/ui/scroll-area';
import { getIdenticon } from '@enclaveid/shared-utils';
import { replaceUserPlaceholders } from './user-placeholder-utils';

interface ConversationsListProps {
  conversations?: Array<{
    id: string;
    title: string | null;
    summary: string | null;
    datetime: Date | null;
    user?: {
      id: string;
      name: string;
    } | null;
  }>;
  currentUserName?: string;
  matchedUserName?: string;
  currentUserPath?: {
    uniqueSummary: string;
    user: { id: string; name: string };
  };
  matchedUserPath?: {
    uniqueSummary: string;
    user: { id: string; name: string };
  };
  isCurrentUserContext?: boolean;
}

export function ConversationsList({
  conversations = [],
  currentUserName,
  matchedUserName,
  currentUserPath,
  matchedUserPath,
  isCurrentUserContext,
}: ConversationsListProps) {
  if (!conversations || conversations.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No conversations found
      </div>
    );
  }

  // Process each conversation summary if we have the user names and paths
  const processConversationSummary = (
    summary: string,
    conversationUser?: { id: string; name: string }
  ) => {
    if (
      currentUserName &&
      matchedUserName &&
      currentUserPath &&
      matchedUserPath
    ) {
      // Determine if this conversation is from the current user's context
      // If isCurrentUserContext is provided, use that
      // Otherwise, try to determine based on the conversation user
      let contextIsCurrentUser = isCurrentUserContext;

      if (typeof contextIsCurrentUser === 'undefined' && conversationUser) {
        // If conversation user matches current user's ID, it's the current user's context
        contextIsCurrentUser = conversationUser.id === currentUserPath.user.id;
      }

      return replaceUserPlaceholders(
        summary,
        currentUserName,
        matchedUserName,
        currentUserPath,
        matchedUserPath,
        contextIsCurrentUser
      );
    }
    return summary;
  };

  return (
    <div className="space-y-4 mt-4 h-[80vh] w-full">
      <ScrollArea className="h-full w-full pb-24">
        <div className="pr-3 w-full">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="mb-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">
                  {conversation.title || 'Conversation'}
                </h4>
                {conversation.user && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={getIdenticon(conversation.user.name)}
                        alt={conversation.user.name}
                      />
                      <AvatarFallback>
                        {conversation.user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {conversation.user.name}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {conversation.datetime
                  ? new Date(conversation.datetime).toLocaleDateString() +
                    ' at ' +
                    new Date(conversation.datetime).toLocaleTimeString()
                  : 'No date available'}
              </p>
              <p>
                {conversation.summary && conversation.user
                  ? processConversationSummary(
                      conversation.summary,
                      conversation.user
                    )
                  : 'No summary available'}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
