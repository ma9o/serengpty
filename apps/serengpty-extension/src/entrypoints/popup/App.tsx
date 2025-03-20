import { useState } from 'react';
import { ExtensionLoginForm } from '../../components/extension-login-form';
import { ExtensionSignupForm } from '../../components/extension-signup-form';
import { Button } from '@enclaveid/ui/button';

function App() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="w-80 h-full flex flex-col">
      {showLogin ? (
        <>
          <ExtensionLoginForm />
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">Don't have an account?</span>
            <Button 
              variant="link" 
              className="p-0 ml-1 text-sm" 
              onClick={() => setShowLogin(false)}
            >
              Sign up
            </Button>
          </div>
        </>
      ) : (
        <>
          <ExtensionSignupForm />
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">Already have an account?</span>
            <Button 
              variant="link" 
              className="p-0 ml-1 text-sm" 
              onClick={() => setShowLogin(true)}
            >
              Log in
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
