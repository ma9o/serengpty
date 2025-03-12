'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { getUnviewedMatchesCount } from '../../actions/getSerendipitousPaths';

interface UnviewedMatchesContextType {
  unviewedCount: number;
  decrementCount: () => void;
  refreshCount: () => Promise<void>;
}

const UnviewedMatchesContext = createContext<UnviewedMatchesContextType | undefined>(undefined);

export function UnviewedMatchesProvider({ children }: { children: ReactNode }) {
  const [unviewedCount, setUnviewedCount] = useState(0);

  // Memoize the decrement function to maintain stable reference
  const decrementCount = useCallback(() => {
    setUnviewedCount(prev => Math.max(0, prev - 1));
  }, []);

  // Memoize the refresh function to maintain stable reference
  const refreshCount = useCallback(async () => {
    try {
      const count = await getUnviewedMatchesCount();
      setUnviewedCount(count);
    } catch (error) {
      console.error('Error fetching unviewed matches count:', error);
    }
  }, []);

  // Initial fetch on component mount
  useEffect(() => {
    // Create a wrapper function to avoid dependency on refreshCount
    // which would cause the effect to re-run whenever the function reference changes
    const fetchInitialCount = async () => {
      try {
        const count = await getUnviewedMatchesCount();
        setUnviewedCount(count);
      } catch (error) {
        console.error('Error fetching initial unviewed matches count:', error);
      }
    };
    
    fetchInitialCount();
    
    // No need for cleanup as this is a one-time fetch operation
  }, []);

  // Memoize the context value to prevent unnecessary re-renders of children
  const contextValue = useMemo(() => ({
    unviewedCount,
    decrementCount,
    refreshCount
  }), [unviewedCount, decrementCount, refreshCount]);

  return (
    <UnviewedMatchesContext.Provider value={contextValue}>
      {children}
    </UnviewedMatchesContext.Provider>
  );
}

export function useUnviewedMatches() {
  const context = useContext(UnviewedMatchesContext);
  if (context === undefined) {
    throw new Error('useUnviewedMatches must be used within an UnviewedMatchesProvider');
  }
  return context;
}