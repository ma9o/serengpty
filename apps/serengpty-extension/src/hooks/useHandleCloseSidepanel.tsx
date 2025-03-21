import { useEffect } from 'react';
import { handleCloseSidepanel } from '../utils/sidepanel';

export function useHandleCloseSidepanel() {
  useEffect(() => {
    handleCloseSidepanel();
  }, []);
}
