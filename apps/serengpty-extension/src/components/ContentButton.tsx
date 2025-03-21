export function ContentButton() {
  const openSidepanel = () => {
    browser.runtime.sendMessage({
      action: 'openSidepanel',
    });
  };

  return (
    <button 
      onClick={openSidepanel}
      className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
      title="Find Similar Users"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    </button>
  );
}
