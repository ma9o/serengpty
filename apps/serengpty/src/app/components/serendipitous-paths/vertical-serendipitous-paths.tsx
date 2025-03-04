'use client';

import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { Skeleton } from '@enclaveid/ui/skeleton';
import { Button } from '@enclaveid/ui/button';
import { cn } from '@enclaveid/ui-utils';
import { ScrollArea } from '@enclaveid/ui/scroll-area';
import { Separator } from '@enclaveid/ui/separator';
import { ChatButton } from '../chat/ChatButton';
import { SerendipitousPathsResponse } from '../../types/serendipitous-paths';
import { ScoreCircle } from './score-circle';
import { getIdenticon } from '../../utils/getIdenticon';
import { getCountryFlag } from '../../utils/getCountryFlag';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@enclaveid/ui/accordion';

interface VerticalSerendipitousPathsProps {
  initialData?: SerendipitousPathsResponse[];
  initialError?: string | null;
}

export function VerticalSerendipitousPaths({
  initialData = [],
  initialError = null,
}: VerticalSerendipitousPathsProps) {
  const [loading, setLoading] = useState(!initialData.length && !initialError);
  const [error, setError] = useState<string | null>(initialError);
  const [data, setData] = useState<SerendipitousPathsResponse[]>(initialData);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (data.length === 0) {
    return <EmptyState />;
  }

  const handleUserSelect = (index: number) => {
    setSelectedUserIndex(index);
    // Reset the selected path when changing users
    setSelectedPathIndex(null);
  };

  const handlePathSelect = (index: number) => {
    setSelectedPathIndex(index);
  };

  const selectedUser = data[selectedUserIndex].connectedUser;
  // For header display, use the first path data for this user
  const userPathsData = data.filter(item => item.connectedUser.id === selectedUser.id);
  const headerPathData = userPathsData[0];
  // For content, use the selected path data or undefined if nothing selected
  const selectedPathData = selectedPathIndex !== null ? data[selectedPathIndex] : undefined;

  return (
    <div className="flex h-full">
      {/* First Section - Users List */}
      <div className="w-1/5 border-r">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Connections</h2>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-2 space-y-2">
            {/* Group data by user to prevent duplicates */}
            {Array.from(
              new Map(
                data.map((item) => [item.connectedUser.id, item])
              ).values()
            ).map((item, index) => (
              <UserCard
                key={item.connectedUser.id}
                user={item.connectedUser}
                score={item.averageUserScore}
                totalPaths={item.totalUserPaths}
                isActive={
                  data[selectedUserIndex].connectedUser.id ===
                  item.connectedUser.id
                }
                onClick={() =>
                  handleUserSelect(
                    data.findIndex(
                      (d) => d.connectedUser.id === item.connectedUser.id
                    )
                  )
                }
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Combined Section (2+3) - Path Summaries as accordions with Path Details */}
      <div className="flex-1">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {headerPathData.totalUserPaths > 1
              ? `Paths with ${selectedUser.name}`
              : `Path with ${selectedUser.name}`}
          </h2>
          <ChatButton
            otherUserId={selectedUser.id}
            otherUserName={selectedUser.name}
            variant="outline"
            size="sm"
            className="flex items-center"
          ></ChatButton>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-2">
            <Accordion 
              type="single" 
              collapsible 
              defaultValue={undefined}
              value={selectedPathIndex !== null ? selectedPathIndex.toString() : undefined}
              onValueChange={(value) => {
                if (value) {
                  handlePathSelect(parseInt(value));
                } else {
                  setSelectedPathIndex(null);
                }
              }}
              className="space-y-2"
            >
              {/* Find all paths for the selected user and display as accordions */}
              {data
                .filter((item) => item.connectedUser.id === selectedUser.id)
                .map((pathData, index) => {
                  // Get the actual index in the full data array
                  const dataIndex = data.findIndex(
                    (d) =>
                      d.path.id === pathData.path.id &&
                      d.connectedUser.id === selectedUser.id
                  );

                  return (
                    <AccordionItem 
                      key={pathData.path.id} 
                      value={dataIndex.toString()}
                      className="border rounded-lg overflow-hidden shadow-sm"
                    >
                      <div className={cn(
                        "bg-background rounded-lg hover:bg-muted/50 transition-colors",
                        selectedPathIndex === dataIndex && "bg-muted/50"
                      )}>
                        <AccordionTrigger className="px-3 py-3 hover:no-underline rounded-lg focus:outline-none">
                          <div className="w-full text-left">
                            <div className="font-medium mb-1">Connection</div>
                            <div className="text-sm text-muted-foreground">{pathData.path.summary}</div>
                          </div>
                        </AccordionTrigger>
                      </div>

                      <AccordionContent 
                        className="px-4 pt-2 pb-4 border-t transition-all"
                        forceMount
                      >
                        <PathDetails pathData={pathData} />
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
}: {
  user: SerendipitousPathsResponse['connectedUser'];
  score: number;
  totalPaths?: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors',
        isActive && 'bg-muted'
      )}
      onClick={onClick}
    >
      <Avatar className={cn('h-10 w-10', isActive && 'ring-2 ring-primary')}>
        <AvatarImage
          src={user.image || getIdenticon(user.name)}
          alt={user.name}
        />
        <AvatarFallback>
          {user.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className="font-medium truncate">{user.name}</div>
        <div className="flex items-center gap-1">
          <div className="text-xs text-muted-foreground">
            <span className="mr-1">{getCountryFlag(user.country)}</span>
            {user.country}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <ScoreCircle percentage={score} size="md" label="Match" />
        <div className="text-xs text-muted-foreground mt-1">Match</div>
      </div>
    </div>
  );
}

// This component is no longer used as we've integrated it directly into the accordion
// Keeping it for reference
function PathSummaryCard({
  path,
  isActive = false,
  onClick,
}: {
  path: SerendipitousPathsResponse['path'];
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors',
        isActive && 'bg-muted'
      )}
      onClick={onClick}
    >
      <div className="font-medium mb-1">Connection</div>
      <div className="text-sm text-muted-foreground">{path.summary}</div>
    </div>
  );
}

// Path Details Component
function PathDetails({ pathData }: { pathData: SerendipitousPathsResponse }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Connection Summary</h3>
        <p className="text-muted-foreground">{pathData.path.summary}</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Common Interests</h3>
        <div className="space-y-3">
          {pathData.commonConversations.length > 0 ? (
            pathData.commonConversations.map((convo) => (
              <ConversationCard key={convo.id} conversation={convo} />
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No common conversations found
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-2">Your Unique Interests</h3>
        <div className="space-y-3">
          {pathData.currentUserUniqueConversations.length > 0 ? (
            pathData.currentUserUniqueConversations.map((convo) => (
              <ConversationCard key={convo.id} conversation={convo} />
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No unique conversations found
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-2">
          {pathData.connectedUser.name}'s Unique Interests
        </h3>
        <div className="space-y-3">
          {pathData.connectedUserUniqueConversations.length > 0 ? (
            pathData.connectedUserUniqueConversations.map((convo) => (
              <ConversationCard key={convo.id} conversation={convo} />
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No unique conversations found for {pathData.connectedUser.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Conversation Card Component
function ConversationCard({ conversation }: { conversation: any }) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="font-medium">{conversation.summary}</div>
      <div className="text-sm text-muted-foreground">
        {new Date(conversation.datetime).toLocaleDateString()}
      </div>
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

                {/* None expanded by default */}
                {false && (
                  <div className="mt-2 p-4 rounded-lg border space-y-6">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                    <Skeleton className="h-1 w-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  </div>
                )}
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
          You don't have any serendipitous connections yet. Keep using the
          platform to discover people with similar interests.
        </p>
        <Button variant="default">Explore Topics</Button>
      </div>
    </div>
  );
}
