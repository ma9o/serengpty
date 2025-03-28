'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { cn } from '@enclaveid/ui-utils';
import { ScoreCircle } from '@enclaveid/ui/score-circle';
import { getIdenticon } from '@enclaveid/shared-browser';
import { getCountryFlag } from '../../utils/getCountryFlag';

export type User = {
  id: string;
  name: string;
  country: string;
};

interface UserCardProps {
  user: User;
  score: number;
  totalPaths?: number;
  isActive?: boolean;
  onClick?: () => void;
  viewed?: boolean;
}

export function UserCard({
  user,
  score,
  totalPaths = 1,
  isActive = false,
  onClick,
  viewed = true,
}: UserCardProps) {
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
            <ScoreCircle percentage={score} size="xs" />
            <div className="text-xs text-muted-foreground">Match</div>
          </div>
        </div>
      </div>
    </div>
  );
}
