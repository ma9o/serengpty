import { handleAuthentication } from '../utils/authentication';
import { handleSidepanel } from '../utils/sidepanel';

export default defineBackground(() => {
  handleSidepanel();
  handleAuthentication();
});
