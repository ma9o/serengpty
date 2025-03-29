import { useState, useEffect } from 'react';
import { dispatchOpenSidepanel } from '../utils/messaging/content';
import logoDark from '~/assets/logo-dark.svg';
import logoLight from '~/assets/logo-light.svg';

export function ContentButton() {
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <button
      onClick={() => dispatchOpenSidepanel({})}
      className={`p-1 flex items-center justify-center w-9 h-9 rounded-full transition-colors shadow-md ${
        isDarkMode ? 'bg-white border border-gray-200' : 'bg-black'
      }`}
      title="Find Similar Users"
    >
      <img
        src={isDarkMode ? logoLight : logoDark}
        alt="Serengpty"
        className="w-6 h-6"
      />
    </button>
  );
}
