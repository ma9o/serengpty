'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { Skeleton } from '@enclaveid/ui/skeleton';
import { Button } from '@enclaveid/ui/button';
import { cn } from '@enclaveid/ui-utils';
import { ScrollArea } from '@enclaveid/ui/scroll-area';
import { Separator } from '@enclaveid/ui/separator';
import { ChatButton } from '../chat/ChatButton';
import { ScoreCircle } from './score-circle';
import { getIdenticon } from '../../utils/getIdenticon';
import { getCountryFlag } from '../../utils/getCountryFlag';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@enclaveid/ui/accordion';
import {
  getSerendipitousPaths,
  markUserMatchAsViewed,
  setPathFeedback,
} from '../../actions/getSerendipitousPaths';
import { useUnviewedMatches } from './UnviewedMatchesContext';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@enclaveid/ui/dialog';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

type UserPathsResponse = Awaited<ReturnType<typeof getSerendipitousPaths>>;

type User = Pick<
  UserPathsResponse[number]['users'][number],
  'id' | 'name' | 'country'
>;

/**
 * Utility function to replace <USER_1>, <USER_2>, and <USER> placeholders with actual usernames
 * @param text The text containing placeholders
 * @param currentUserName Name of the current user
 * @param otherUserName Name of the other user
 * @param currentUserPath The path data for the current user
 * @param matchedUserPath The path data for the matched user
 * @param isCurrentUserContext Optional flag to indicate if we're in current user's context
 * @returns The text with placeholders replaced with proper usernames
 */
function replaceUserPlaceholders(
  text: string,
  currentUserName: string,
  otherUserName: string,
  currentUserPath: {
    uniqueSummary: string;
    user: { id: string; name: string };
  },
  matchedUserPath: {
    uniqueSummary: string;
    user: { id: string; name: string };
  },
  isCurrentUserContext?: boolean
): string {
  // Determine which user is USER_1 and which is USER_2 by checking the uniqueSummary field
  let user1Name: string;
  let user2Name: string;

  // If the current user's path contains <USER_1>, then the current user is USER_1
  if (currentUserPath.uniqueSummary.includes('<USER_1>')) {
    user1Name = currentUserName;
    user2Name = otherUserName;
  } else if (currentUserPath.uniqueSummary.includes('<USER_2>')) {
    user1Name = otherUserName;
    user2Name = currentUserName;
  } else {
    // If we can't determine from the current user's path, check the matched user's path
    if (matchedUserPath.uniqueSummary.includes('<USER_1>')) {
      user1Name = otherUserName;
      user2Name = currentUserName;
    } else {
      // Default fallback if we can't determine from either path
      user1Name = currentUserName;
      user2Name = otherUserName;
    }
  }

  // Replace placeholders with actual names
  let processed = text
    .replace(/<USER_1>/g, user1Name)
    .replace(/<USER_2>/g, user2Name);

  // Replace generic <USER> placeholder based on context
  if (typeof isCurrentUserContext !== 'undefined') {
    // If we know the context, replace with the appropriate name
    processed = processed.replace(
      /<USER>/g,
      isCurrentUserContext ? currentUserName : otherUserName
    );
  } else {
    // If we don't know the context, replace based on the conversation context
    // If it's in "Your Perspective" or "Your Unique Conversations", use current user
    // Otherwise, use the conversation user if available
    processed = processed.replace(/<USER>/g, currentUserName);
  }

  return processed;
}

interface VerticalSerendipitousPathsProps {
  initialData?: UserPathsResponse;
  initialError?: string | null;
}

export function VerticalSerendipitousPaths({
  initialData = [],
  initialError = null,
}: VerticalSerendipitousPathsProps) {
  const [loading] = useState(initialData.length === 0 && !initialError);
  const [error] = useState<string | null>(initialError);
  const [data, setData] = useState<UserPathsResponse>(initialData);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const { decrementCount } = useUnviewedMatches();

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (data.length === 0) {
    return <EmptyState />;
  }

  const handleUserSelect = async (index: number) => {
    const match = data[index];

    // If the match hasn't been viewed yet, mark it as viewed
    if (!match.viewed) {
      try {
        await markUserMatchAsViewed(match.id);
        // Update the local state to reflect the change
        const updatedData = [...data];
        updatedData[index] = { ...match, viewed: true };
        setData(updatedData);

        // Update the unviewed count in context
        decrementCount();
      } catch (error) {
        console.error('Failed to mark match as viewed:', error);
      }
    }

    setSelectedMatchIndex(index);
    setSelectedPathId(null);
  };

  const handlePathSelect = (pathId: string | null) => {
    setSelectedPathId(pathId);
  };

  // Sort the data array by score in descending order
  const sortedData = [...data].sort((a, b) => b.score - a.score);

  // Get the current selected match
  const selectedMatch = sortedData[selectedMatchIndex];
  // Get the matched user (the one who is not the current user)
  const matchedUser = selectedMatch.users[0];

  return (
    <div className="flex h-full">
      {/* First Section - Users List */}
      <div className="w-1/5 border-r">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Connections</h2>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-2 space-y-2">
            {sortedData.map((match, index) => {
              const user = match.users[0];
              return (
                <UserCard
                  key={user.id}
                  user={user}
                  score={match.score}
                  totalPaths={match.serendipitousPaths.length}
                  isActive={index === selectedMatchIndex}
                  viewed={match.viewed}
                  onClick={() => handleUserSelect(index)}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Path Summaries and Details */}
      <div className="flex-1">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {selectedMatch.serendipitousPaths.length > 1
              ? `Paths with ${matchedUser.name}`
              : `Path with ${matchedUser.name}`}
          </h2>
          <ChatButton
            otherUserId={matchedUser.id}
            otherUserName={matchedUser.name}
            variant="outline"
            size="sm"
            className="flex items-center"
          />
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-2">
            <Accordion
              type="single"
              collapsible
              value={selectedPathId || undefined}
              onValueChange={(value) => {
                handlePathSelect(value || null);
              }}
              className="space-y-2"
            >
              {selectedMatch.serendipitousPaths.map((path) => {
                // Find current user and matched user paths for this serendipitous path
                const pMatchedUserPath = path.userPaths.find(
                  (p) => p.user.id === matchedUser.id
                );
                const pCurrentUserPath = path.userPaths.find(
                  (p) => p.user.id !== matchedUser.id
                );

                // Only proceed with replacement if we have both paths
                let processedTitle = path.title;
                let processedSummary = path.commonSummary;

                if (pCurrentUserPath && pMatchedUserPath) {
                  const currentUserName = pCurrentUserPath.user.name;

                  // Process title and summary
                  processedTitle = replaceUserPlaceholders(
                    path.title,
                    currentUserName,
                    matchedUser.name,
                    pCurrentUserPath,
                    pMatchedUserPath
                  );

                  processedSummary = replaceUserPlaceholders(
                    path.commonSummary,
                    currentUserName,
                    matchedUser.name,
                    pCurrentUserPath,
                    pMatchedUserPath
                  );
                }

                return (
                  <AccordionItem
                    key={path.id}
                    value={path.id}
                    className="border rounded-lg overflow-hidden shadow-sm"
                  >
                    <div
                      className={cn(
                        'bg-background rounded-lg hover:bg-muted/50 transition-colors',
                        selectedPathId === path.id && 'bg-muted/50'
                      )}
                    >
                      <AccordionTrigger className="px-3 py-3 hover:no-underline rounded-lg focus:outline-none">
                        <div className="w-full text-left flex justify-between items-start gap-2">
                          <div className="flex-row">
                            <div className="flex justify-between items-center">
                              <div className="font-medium mb-1">
                                {processedTitle}
                              </div>
                              <PathFeedback
                                pathId={path.id}
                                existingFeedback={path.feedback?.[0]?.score}
                              />
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {processedSummary}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                    </div>

                    <AccordionContent className="px-4 pt-2 pb-4 border-t transition-all">
                      <PathDetails path={path} matchedUser={matchedUser} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// User Card Component
function UserCard({
  user,
  score,
  totalPaths = 1,
  isActive = false,
  onClick,
  viewed = true,
}: {
  user: User;
  score: number;
  totalPaths?: number;
  isActive?: boolean;
  onClick?: () => void;
  viewed?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors',
        isActive && 'bg-muted',
        !viewed && 'bg-primary/10'
      )}
      onClick={onClick}
    >
      <Avatar className={cn('h-10 w-10', isActive && 'ring-2 ring-primary')}>
        <AvatarImage src={getIdenticon(user.name)} alt={user.name} />
        <AvatarFallback>
          {user.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className="font-medium truncate flex items-center gap-1">
          {user.name}
          <span className="mt-1">{getCountryFlag(user.country)}</span>
          {!viewed && (
            <span className="inline-flex h-2 w-2 rounded-full bg-primary"></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ScoreCircle percentage={score} size="xs" label="Match" />
            <div className="text-xs text-muted-foreground">Match</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Path Details Component
function PathDetails({
  path,
  matchedUser,
}: {
  path: UserPathsResponse[number]['serendipitousPaths'][number];
  matchedUser: User;
}) {
  // Find the current user and matched user paths
  const matchedUserPath = path.userPaths.find(
    (p) => p.user.id === matchedUser.id
  );
  const currentUserPath = path.userPaths.find(
    (p) => p.user.id !== matchedUser.id
  );

  // Always declare hooks at the top level, before any early returns
  // Use empty strings as fallbacks for the text fields if paths are not found
  const currentUserName = currentUserPath?.user.name || '';

  // Process all text fields to replace <USER_1> and <USER_2> with actual usernames
  const processedCommonSummary = useMemo(() => {
    if (!matchedUserPath || !currentUserPath) return '';

    return replaceUserPlaceholders(
      path.commonSummary,
      currentUserName,
      matchedUser.name,
      currentUserPath,
      matchedUserPath
    );
  }, [
    path.commonSummary,
    currentUserName,
    matchedUser.name,
    currentUserPath,
    matchedUserPath,
  ]);

  const processedCurrentUserSummary = useMemo(() => {
    if (!matchedUserPath || !currentUserPath) return '';

    return replaceUserPlaceholders(
      currentUserPath.uniqueSummary,
      currentUserName,
      matchedUser.name,
      currentUserPath,
      matchedUserPath
    );
  }, [currentUserName, matchedUser.name, currentUserPath, matchedUserPath]);

  const processedMatchedUserSummary = useMemo(() => {
    if (!matchedUserPath || !currentUserPath) return '';

    return replaceUserPlaceholders(
      matchedUserPath.uniqueSummary,
      currentUserName,
      matchedUser.name,
      currentUserPath,
      matchedUserPath
    );
  }, [currentUserName, matchedUser.name, currentUserPath, matchedUserPath]);

  const processedCallToAction = useMemo(() => {
    if (!matchedUserPath || !currentUserPath) return '';

    return replaceUserPlaceholders(
      currentUserPath.uniqueCallToAction,
      currentUserName,
      matchedUser.name,
      currentUserPath,
      matchedUserPath
    );
  }, [currentUserName, matchedUser.name, currentUserPath, matchedUserPath]);

  if (!matchedUserPath || !currentUserPath) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        Could not find complete path data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Path Flow Container */}
      <div className="flex flex-row items-center justify-between gap-4">
        {/* Common Summary with View Conversations Button */}
        <div className="flex-1 p-4 bg-muted rounded-lg relative">
          <h3 className="text-lg font-medium mb-2">Common Interest</h3>
          <p>{processedCommonSummary}</p>
          <div className="mt-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  View Conversations ({path.commonConversations.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[80vw] max-h-[80vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>
                    Common Conversations ({path.commonConversations.length})
                  </DialogTitle>
                  <DialogDescription>
                    Conversations shared between users in this path
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-hidden">
                  <ConversationsList
                    conversations={path.commonConversations}
                    currentUserName={currentUserName}
                    matchedUserName={matchedUser.name}
                    currentUserPath={currentUserPath}
                    matchedUserPath={matchedUserPath}
                    // Common conversations don't belong to either user specifically
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Separator: Split Arrow */}
        <div className="flex-shrink-0">
          <Image
            src="/arrow-split.svg"
            alt="Paths split"
            width={40}
            height={40}
            className="w-auto"
          />
        </div>

        {/* Unique Summaries */}
        <div className="flex-1 flex flex-col space-y-4">
          {/* Your Path */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="text-lg font-medium mb-2">Your Perspective</h3>
            <p>{processedCurrentUserSummary}</p>
            <div className="mt-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View Conversations (
                    {currentUserPath.uniqueConversations.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[80vw] max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>
                      Your Unique Conversations (
                      {currentUserPath.uniqueConversations.length})
                    </DialogTitle>
                    <DialogDescription>
                      Conversations unique to your perspective
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <ConversationsList
                      conversations={currentUserPath.uniqueConversations}
                      currentUserName={currentUserName}
                      matchedUserName={matchedUser.name}
                      currentUserPath={currentUserPath}
                      matchedUserPath={matchedUserPath}
                      isCurrentUserContext={true} // These are current user's conversations
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Separator />

          {/* Their Path */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="text-lg font-medium mb-2">
              {matchedUser.name}&apos;s Perspective
            </h3>
            <p>{processedMatchedUserSummary}</p>
            <div className="mt-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View Conversations (
                    {matchedUserPath.uniqueConversations.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[80vw] max-h-[80vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>
                      {matchedUser.name}&apos;s Unique Conversations (
                      {matchedUserPath.uniqueConversations.length})
                    </DialogTitle>
                    <DialogDescription>
                      Conversations unique to {matchedUser.name}&apos;s
                      perspective
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-hidden">
                    <ConversationsList
                      conversations={matchedUserPath.uniqueConversations}
                      currentUserName={currentUserName}
                      matchedUserName={matchedUser.name}
                      currentUserPath={currentUserPath}
                      matchedUserPath={matchedUserPath}
                      isCurrentUserContext={false} // These are the other user's conversations
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Separator: Merge Arrow */}
        <div className="flex-shrink-0">
          <Image
            src="/arrow-merge.svg"
            alt="Paths merge"
            width={40}
            height={40}
            className="w-auto"
          />
        </div>

        {/* Call to Action */}
        <div className="flex-1 bg-muted p-4 rounded-lg text-center flex flex-col items-center justify-center">
          <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
          <p className="text-muted-foreground mb-3">{processedCallToAction}</p>
          <ChatButton
            otherUserId={matchedUser.id}
            otherUserName={matchedUser.name}
            variant="default"
            size="default"
            initialText={processedCallToAction}
          />
        </div>
      </div>
    </div>
  );
}

// Conversations list component for modals
function ConversationsList({
  conversations = [],
  currentUserName,
  matchedUserName,
  currentUserPath,
  matchedUserPath,
  isCurrentUserContext,
}: {
  conversations?: Array<{
    id: string;
    title?: string;
    summary: string;
    datetime: Date;
    user?: {
      id: string;
      name: string;
    };
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
}) {
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
                {new Date(conversation.datetime).toLocaleDateString()} at{' '}
                {new Date(conversation.datetime).toLocaleTimeString()}
              </p>
              <p>
                {processConversationSummary(
                  conversation.summary,
                  conversation.user
                )}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex h-full">
      {/* First column loading */}
      <div className="w-1/6 border-r">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Combined column loading (sections 2+3) */}
      <div className="flex-1">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-2 mb-6">
                <div className="p-3 rounded-lg border">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// Error State
function ErrorState({ error }: { error: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-destructive/10 p-6 rounded-xl text-center max-w-md">
        <h3 className="text-xl font-bold text-destructive mb-2">
          Error Loading Connections
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-muted p-8 rounded-xl text-center max-w-md">
        <h3 className="text-xl font-bold mb-2">No Connections Found</h3>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have any serendipitous connections yet. Keep using the
          platform to discover people with similar interests.
        </p>
        <Button variant="default">Explore Topics</Button>
      </div>
    </div>
  );
}

// Path Feedback Component
function PathFeedback({
  pathId,
  existingFeedback,
}: {
  pathId: string;
  existingFeedback?: number;
}) {
  const [score, setScore] = useState<number | undefined>(existingFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (value: 1 | -1) => {
    try {
      setIsSubmitting(true);
      // If clicking the same button again, remove the feedback
      const newValue = score === value ? undefined : value;

      if (newValue !== undefined) {
        await setPathFeedback(pathId, newValue);
        setScore(newValue);
      } else {
        // For now we don't provide an API to delete feedback, so we'll just toggle
        await setPathFeedback(pathId, 0);
        setScore(0);
      }
    } catch (error) {
      console.error('Error setting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-2 ml-2"
      onClick={(e) => e.stopPropagation()} // Prevent accordion from toggling
    >
      <ThumbsUp
        className={cn('h-4 w-4', score === 1 && 'text-green-500')}
        onClick={(e) => {
          e.stopPropagation();
          handleFeedback(1);
        }}
      />

      <ThumbsDown
        className={cn('h-4 w-4', score === -1 && 'text-red-500')}
        onClick={(e) => {
          e.stopPropagation();
          handleFeedback(-1);
        }}
      />
    </div>
  );
}
