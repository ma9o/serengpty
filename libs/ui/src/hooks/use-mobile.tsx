import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Safely handle SSR (server-side rendering)
    if (typeof window === 'undefined') return;
    
    // Create MediaQueryList for the mobile breakpoint
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Handler function that uses MediaQueryList's matches property
    // This is more reliable than manually checking window.innerWidth
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    
    // Add listener for viewport changes
    mql.addEventListener("change", onChange)
    
    // Set initial value
    setIsMobile(mql.matches)
    
    // Cleanup function to prevent memory leaks
    return () => mql.removeEventListener("change", onChange)
  }, []) // Empty deps array is correct as this only needs to run once on mount

  return !!isMobile
}
