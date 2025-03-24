import { Button } from '@enclaveid/ui';
import { useCompletion } from '@ai-sdk/react';
import { API_BASE_URL } from '../services/api';
import { useEffect, useCallback } from 'react';

export function SummaryButton({
  currentConversationId,
  otherConversationId,
  setCompletion,
}: {
  currentConversationId?: string;
  otherConversationId?: string;
  setCompletion?: (completion: string) => void;
}) {
  const { completion, complete, isLoading } = useCompletion({
    api: `${API_BASE_URL}/common-summary`,
    body: {
      currentConversationId,
      otherConversationId,
    },
  });

  useEffect(() => {
    if (completion && setCompletion) {
      setCompletion(completion);
    }
  }, [completion]);

  const onSubmit = useCallback(() => {
    if (currentConversationId && otherConversationId) {
      complete(''); // Empty since data is fetched server side
    }
  }, [complete, currentConversationId, otherConversationId]);

  return (
    <Button
      disabled={
        isLoading ||
        !!completion ||
        !currentConversationId ||
        !otherConversationId
      }
      onClick={onSubmit}
      size="sm"
      variant="outline"
    >
      {isLoading ? 'Loading...' : "What's in common?"}
    </Button>
  );
}
