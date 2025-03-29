import { useState, useEffect, useRef } from 'react';
// Keep other imports as they were
import { dispatchOpenSidepanel } from '../utils/messaging/content';
import logoDark from '~/assets/logo-dark.svg';
import logoLight from '~/assets/logo-light.svg';

interface ContentButtonProps {
  peekExpand?: boolean;
}

export function ContentButton({ peekExpand = false }: ContentButtonProps) {
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [isHovered, setIsHovered] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);

  // Refs to hold timeout IDs for cleanup
  const peekStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const peekEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Dark Mode Effect ---
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    // Ensure initial state is accurate after mount
    setIsDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // --- Peek Expand Effect ---
  useEffect(() => {
    // --- Cleanup Function ---
    // Clear any existing timeouts when effect re-runs or component unmounts
    const clearTimeouts = () => {
      if (peekStartTimeoutRef.current) {
        clearTimeout(peekStartTimeoutRef.current);
        peekStartTimeoutRef.current = null;
      }
      if (peekEndTimeoutRef.current) {
        clearTimeout(peekEndTimeoutRef.current);
        peekEndTimeoutRef.current = null;
      }
    };

    clearTimeouts(); // Clear previous timeouts first

    if (peekExpand) {
      // --- Start Peek Timeout ---
      // Wait 1 second before starting the expansion
      peekStartTimeoutRef.current = setTimeout(() => {
        setIsPeeking(true); // Expand the button
        peekStartTimeoutRef.current = null; // This timeout is done

        // --- End Peek Timeout ---
        // Wait 1.5 seconds while expanded, then close
        peekEndTimeoutRef.current = setTimeout(() => {
          setIsPeeking(false); // Collapse the button
          peekEndTimeoutRef.current = null; // This timeout is done
        }, 1500); // 1.5 seconds duration
      }, 1000); // 1 second delay before starting
    } else {
      // If peekExpand becomes false, immediately ensure button is not peeking
      setIsPeeking(false);
      // We already cleared timeouts above, so no need to clear again here
    }

    // Return the cleanup function to be called on unmount or before next effect run
    return clearTimeouts;
  }, [peekExpand]); // Re-run effect if peekExpand prop changes

  const isExpanded = isHovered || isPeeking;

  return (
    <button
      onClick={() => dispatchOpenSidepanel({})}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        group relative flex items-center justify-end h-9 rounded-full
        shadow-md transition-all duration-300 ease-in-out overflow-hidden
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${
          isDarkMode
            ? 'bg-white border border-gray-200 text-black focus:ring-gray-400'
            : 'bg-black text-white focus:ring-gray-600'
        }
        ${isExpanded ? 'w-48' : 'w-9'}
      `}
      // title="Find Similar Users" // Optional: keep or remove
    >
      <span
        aria-hidden={!isExpanded}
        className={`
          mr-2 ml-3 whitespace-nowrap text-sm font-medium
          transition-opacity duration-200 ease-in-out
          ${isExpanded ? 'opacity-100 delay-150' : 'opacity-0 delay-0'}
        `}
      >
        Find Similar Users
      </span>
      <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center p-1">
        <img
          src={isDarkMode ? logoLight : logoDark}
          alt="Find Similar Users"
          className="w-6 h-6"
        />
      </div>
    </button>
  );
}
