import { createMessageDispatcher } from '../factory';
import { CloseSidepanelMessage, GetSidepanelStateMessage } from '../types';

// Export direct message dispatchers for sidepanel
export const dispatchCloseSidepanel = createMessageDispatcher<CloseSidepanelMessage>(
  'closeSidePanel', 'sidepanel', 'runtime'
);

export const dispatchGetSidepanelState = createMessageDispatcher<GetSidepanelStateMessage>(
  'getSidepanelState', 'sidepanel', 'runtime'
);