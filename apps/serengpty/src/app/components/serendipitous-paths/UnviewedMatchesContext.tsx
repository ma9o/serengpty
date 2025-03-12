'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUnviewedMatchesCount } from '../../actions/getSerendipitousPaths';

interface UnviewedMatchesContextType {
  unviewedCount: number;
  decrementCount: () => void;
  refreshCount: () => Promise<void>;
}

const UnviewedMatchesContext = createContext<UnviewedMatchesContextType | undefined>(undefined);

export function UnviewedMatchesProvider({ children }: { children: ReactNode }) {
  const [unviewedCount, setUnviewedCount] = useState(0);

  const decrementCount = () => {
    setUnviewedCount(prev => Math.max(0, prev - 1));
  };

  const refreshCount = async () => {
    try {
      const count = await getUnviewedMatchesCount();
      setUnviewedCount(count);
    } catch (error) {
      console.error('Error fetching unviewed matches count:', error);
    }
  };

  // Initial fetch on component mount
  // We need to include refreshCount in dependencies and handle it properly
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

  return (
    <UnviewedMatchesContext.Provider value={{ unviewedCount, decrementCount, refreshCount }}>
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