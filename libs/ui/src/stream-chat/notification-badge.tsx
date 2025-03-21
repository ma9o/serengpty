/**
 * NotificationBadge Component
 * 
 * Displays an unread count badge that can be used with
 * navigation items, buttons, or other UI elements.
 */
import React from 'react';
import { cn } from '@enclaveid/ui-utils';

interface NotificationBadgeProps {
  count: number;
  max?: number;
  className?: string;
  showZero?: boolean;
}

export function NotificationBadge({
  count,
  max = 99,
  className,
  showZero = false,
}: NotificationBadgeProps) {
  // Don't render if count is 0 and showZero is false
  if (count === 0 && !showZero) {
    return null;
  }

  // Format the display number (e.g., 100+ if over max)
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <div
      className={cn(
        'chat-notification-badge',
        'flex items-center justify-center',
        'min-w-[1.125rem] h-[1.125rem]',
        'px-1 py-0.5',
        'rounded-full',
        'bg-red-500 text-white',
        'text-xs font-bold',
        className
      )}
    >
      {displayCount}
    </div>
  );
}