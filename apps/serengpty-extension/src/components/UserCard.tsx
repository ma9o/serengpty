import { getIdenticon } from '@enclaveid/shared-utils';
import { ScoreCircle } from '@enclaveid/ui/score-circle';

export type User = {
  id: string;
  name: string;
  score: number;
};

interface UserCardProps {
  user: User;
  isActive?: boolean;
  onClick?: () => void;
}

export function UserCard({ user, isActive = false, onClick }: UserCardProps) {
  return (
    <div
      className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors ${
        isActive ? 'bg-gray-100' : ''
      }`}
      onClick={onClick}
    >
      <div
        className={`h-10 w-10 rounded-full overflow-hidden ${
          isActive ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <img
          src={getIdenticon(user.name)}
          alt={user.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="font-medium truncate">{user.name}</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <ScoreCircle percentage={user.score} size="xs" />
            <div className="text-xs text-gray-500">Similarity</div>
          </div>
        </div>
      </div>
    </div>
  );
}
