import { handleAuthentication } from '../utils/authentication';
import { handleOpenSidepanel } from '../utils/sidepanel';

export default defineBackground(() => {
  handleOpenSidepanel();
  handleAuthentication();
});
