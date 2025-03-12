'use client';

import { useState } from 'react';
import { ScrollArea } from '@enclaveid/ui/scroll-area';
import { ChatButton } from '../chat/ChatButton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@enclaveid/ui/accordion';
import { Badge } from '@enclaveid/ui/badge';
import { cn } from '@enclaveid/ui-utils';
import { markUserMatchAsViewed } from '../../actions/getSerendipitousPaths';
import { useUnviewedMatches } from './UnviewedMatchesContext';
import { UserCard } from './user-card';
import { PathDetails } from './path-details';
import { PathFeedback } from './path-feedback';
import { LoadingState, ErrorState, EmptyState } from './ui-states';
import { UserPathsResponse } from './types';
import { replaceUserPlaceholders } from './user-placeholder-utils';

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
                              <div className="font-medium mb-1 flex items-center gap-2">
                                {path.isSensitive && (
                                  <Badge className="bg-red-500/20 border-red-700 text-red-700 pointer-events-none">
                                    Sensitive
                                  </Badge>
                                )}
                                <Badge
                                  className={cn(
                                    'pointer-events-none capitalize',
                                    {
                                      humanistic:
                                        'bg-green-500/20 border-green-700 text-green-700',

                                      research:
                                        'bg-purple-500/20 border-purple-700 text-purple-700',
                                      coding:
                                        'bg-amber-500/20 border-amber-700 text-amber-700',
                                      practical:
                                        'bg-orange-500/20 border-orange-700 text-orange-700',
                                    }[path.category]
                                  )}
                                >
                                  {path.category}
                                </Badge>
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
