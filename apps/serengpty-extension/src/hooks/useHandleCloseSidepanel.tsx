import { useEffect } from 'react';
import { handleCloseSidepanel } from '../utils/sidepanel';

export function useHandleCloseSidepanel() {
  useEffect(() => {
    const cleanup = handleCloseSidepanel();
    return cleanup;
  }, []);
}