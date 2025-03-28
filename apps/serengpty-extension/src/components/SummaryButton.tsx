import { Button } from '@enclaveid/ui';
import { useCompletion } from '@ai-sdk/react';
import { API_BASE_URL } from '../services/api';
import { useEffect, useCallback, useState } from 'react';
import { userDataStorage } from '../utils/storage';

export function SummaryButton({
  currentConversationId,
  otherConversationId,
  setCompletion,
}: {
  currentConversationId?: string;
  otherConversationId?: string;
  setCompletion?: (completion: string) => void;
}) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch the API key from storage
    userDataStorage.getValue().then((userData) => {
      if (userData) {
        setApiKey(userData.extensionApiKey);
      }
    });
  }, []);
  
  const { completion, complete, isLoading } = useCompletion({
    api: `${API_BASE_URL}/common-summary`,
    body: {
      apiKey,
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
    if (currentConversationId && otherConversationId && apiKey) {
      complete(''); // Empty since data is fetched server side
    }
  }, [complete, currentConversationId, otherConversationId, apiKey]);

  return (
    <Button
      disabled={
        isLoading ||
        !!completion ||
        !currentConversationId ||
        !otherConversationId ||
        !apiKey
      }
      onClick={onSubmit}
      size="sm"
      variant="outline"
    >
      {isLoading ? 'Loading...' : "What's in common?"}
    </Button>
  );
}
