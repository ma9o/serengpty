'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@enclaveid/ui/button';
import { Separator } from '@enclaveid/ui/separator';
import { ChatButton } from '../chat/ChatButton';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@enclaveid/ui/dialog';
import { ConversationsList } from './conversation-list';
import { replaceUserPlaceholders } from './user-placeholder-utils';
import { User } from './user-card';
import { getSerendipitousPaths } from '../../actions/getSerendipitousPaths';

type UserPathsResponse = Awaited<ReturnType<typeof getSerendipitousPaths>>;

interface PathDetailsProps {
  path: UserPathsResponse[number]['serendipitousPaths'][number];
  matchedUser: User;
}

export function PathDetails({ path, matchedUser }: PathDetailsProps) {
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
      <div className="mt-3 absolute right-10">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              View common path ({path.commonConversations.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[80vw] max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Common Path ({path.commonConversations.length})
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
      <div className="flex flex-row items-center justify-between gap-4">
        {/* Unique Summaries */}
        <div className="flex-1 flex flex-col space-y-4">
          {/* Your Path */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="text-lg font-medium mb-2">Your Perspective</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{processedCurrentUserSummary}</ReactMarkdown>
            </div>
            <div className="mt-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View your unique path (
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
            <h3 className="text-lg font-medium mb-2">Their Perspective</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{processedMatchedUserSummary}</ReactMarkdown>
            </div>
            <div className="mt-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View {matchedUser.name}&apos;s unique path (
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
        <div className="flex-1 bg-muted p-4 rounded-lg flex flex-col">
          <h3 className="text-lg font-medium mb-2">Start a Conversation</h3>
          <div className="prose prose-sm dark:prose-invert text-muted-foreground mb-3 max-w-none">
            <ReactMarkdown>{processedCallToAction}</ReactMarkdown>
          </div>
          <div className="mt-auto">
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
    </div>
  );
}