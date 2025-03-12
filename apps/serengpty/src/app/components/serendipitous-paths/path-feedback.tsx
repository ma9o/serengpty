'use client';

import { useState } from 'react';
import { cn } from '@enclaveid/ui-utils';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { setPathFeedback } from '../../actions/getSerendipitousPaths';

interface PathFeedbackProps {
  pathId: string;
  existingFeedback?: number;
}

export function PathFeedback({
  pathId,
  existingFeedback,
}: PathFeedbackProps) {
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