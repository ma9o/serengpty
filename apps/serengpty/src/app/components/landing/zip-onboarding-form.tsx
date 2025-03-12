'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import {
  FileArchive,
  Loader2,
  XCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Toaster } from '@enclaveid/ui/toaster';
import { processZipFile } from '../../utils/clientZipUtils';
import { Icon } from '@iconify/react';
import { validateUsername } from '../../actions/validateUsername';
import { getUniqueUsername } from '../../actions/getUniqueUsername';

import { validatePassword } from '../../actions/validatePassword';

/**
 * ZipOnboardingForm component wraps the ZipDropzone.
 * When a file is dropped, we process it on the client side,
 * generate a password, update UI feedback statuses, and then
 * reveal a sign-up button that will handle the final sign-up with just the cleaned conversations data.
 */
export function ZipOnboardingForm() {
  const { toast } = useToast();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customUsername, setCustomUsername] = useState('');
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [providerName, setProviderName] = useState<
    'anthropic' | 'openai' | undefined
  >(undefined);
  const [cleanedConversations, setCleanedConversations] = useState<
    Record<string, unknown>[]
  >([]);

  async function handleFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;

    // Reset state for a new upload.
    setError('');
    setUsernameError('');
    setPasswordError('');
    setProcessing(true);
    setReady(false);
    setPassword('');
    setProgress(0);
    setCustomUsername(await getUniqueUsername());
    setCleanedConversations([]);
    setProviderName(undefined);

    try {
      // Reset progress before starting
      setProgress(0);

      // Process the zip file on the client side with progress updates
      const result = await processZipFile(file, (progressValue) => {
        setProgress(progressValue);
      });

      if (!result.success || !result.conversations) {
        setError('Failed to process the archive.');
        setProcessing(false);
        return;
      }

      setCleanedConversations(result.conversations);
      setProviderName(result.providerName);
      setReady(true);
    } catch (err) {
      console.error(err);
      setError('An error occurred during processing.');
    } finally {
      setProcessing(false);
    }
  }

  // Add a debounced username validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customUsername) {
        const result = await validateUsername(customUsername);
        if (!result.isValid) {
          setUsernameError(result.message || 'Username is invalid');
        } else {
          setUsernameError('');
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customUsername]);

  // Add a debounced password validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (password) {
        const result = await validatePassword(password);
        if (!result.isValid) {
          setPasswordError(result.message || 'Password is invalid');
        } else {
          setPasswordError('');
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [password]);

  const validateCustomUsername = async (username: string) => {
    if (!username.trim()) {
      setUsernameError('Username is required');
      return false;
    }

    const result = await validateUsername(username);

    if (!result.isValid) {
      setUsernameError(result.message || 'Username is invalid');
      return false;
    }

    setUsernameError('');
    return true;
  };

  const validateUserPassword = async () => {
    if (!password.trim()) {
      setPasswordError('Password is required');
      return false;
    }

    const result = await validatePassword(password);

    if (!result.isValid) {
      setPasswordError(result.message || 'Password is invalid');
      return false;
    }

    setPasswordError('');
    return true;
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!cleanedConversations) {
      setError('Missing conversation data for submission.');
      return;
    }

    // Validate username and password
    if (!(await validateCustomUsername(customUsername))) {
      return;
    }

    if (!validateUserPassword()) {
      return;
    }

    try {
      setProcessing(true);
      // Start with a small progress value to show activity
      setProgress(5);

      // Create FormData with only the cleaned data
      const formData = new FormData();
      // Only add the cleaned conversations.json data to the form
      formData.append('conversations', JSON.stringify(cleanedConversations));
      formData.append('password', password);

      // Add username
      formData.append('username', customUsername);

      // Add provider name if available
      if (providerName) {
        formData.append('providerName', providerName);
      }

      // Send the data to our signup API
      // Simulated upload progress
      const simulateProgress = () => {
        setProgress((prev) => {
          // Increment progress but don't reach 100% until complete
          const nextProgress = prev + Math.random() * 15;
          return Math.min(nextProgress, 90);
        });
      };

      // Start progress simulation
      const progressInterval = setInterval(simulateProgress, 500);

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      });

      // Clear the interval and set to 100% when complete
      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to sign up',
        });
        return;
      }

      // Redirect to the dashboard
      window.location.href = '/onboarding';
    } catch (err: unknown) {
      console.error(err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred during sign up.';
      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  }

  // Set up the dropzone directly in this component
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/octet-stream': ['.dms'],
    },
    multiple: false,
    disabled: processing,
    // This ensures the dropzone is always ready to accept new files
    noClick: ready,
    noKeyboard: ready,
    noDrag: ready,
  });

  return (
    <div className="onboarding-form p-4 w-full md:w-1/2">
      <Toaster />

      <form onSubmit={handleSubmit}>
        {/* When processing is complete, show the sign-up button */}
        {!ready ? (
          <div>
            {/* Robot icon message */}
            <div className="mb-2 flex items-center justify-center">
              {error ? (
                <>
                  <Icon
                    icon="mage:robot-sad"
                    width="24"
                    height="24"
                    className="text-red-500 mr-2"
                  />
                  <span className="text-red-500">{error}</span>
                </>
              ) : (
                !processing && (
                  <>
                    <Icon
                      icon="mage:robot-happy"
                      width="24"
                      height="24"
                      className="text-gray-500 mr-2"
                    />
                    <p className="text-sm text-gray-500 font-medium">
                      Your data will be anonymized locally before uploading
                    </p>
                  </>
                )
              )}
            </div>

            {/* Processing indicator or Dropzone */}
            {processing ? (
              <div className="w-full mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center w-full">
                  <Icon
                    icon="mage:robot-happy"
                    width="24"
                    height="24"
                    className="mb-2"
                  />
                  <div className="flex items-center mb-2">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    <span className="">We&apos;re anonymizing the data...</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full mt-2 max-w-md">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Processing conversations.json: {progress}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className="relative w-full mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center hover:border-green-800 transition-colors cursor-pointer"
              >
                <input {...getInputProps()} />
                {/* <FileArchive className="mb-4 text-gray-500" size={32} /> */}
                <p className="mt-2 text-base text-gray-500">
                  Drop your data export zip here
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Only *.zip and *.dms files are accepted
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-4">
              <FileArchive className="mb-4 text-gray-700" size={32} />
              <p className="text-md text-gray-700 mb-4 w-[400px]">
                Your
                <span className="font-bold">
                  {providerName === 'anthropic' ? ' Claude ' : ' ChatGPT '}
                </span>
                archive is ready to be uploaded!
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 w-[470px]">
              <div className="w-full">
                <label
                  htmlFor="username"
                  className="block text-sm font-medium mb-1"
                >
                  Choose a username
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="Enter your desired username"
                    className="w-full mb-1"
                    autoComplete="username"
                    required
                  />
                  {customUsername &&
                    (!usernameError ? (
                      <CheckCircle
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${'text-green-500'}`}
                        size={16}
                      />
                    ) : (
                      <XCircle
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${'text-red-500'}`}
                        size={16}
                      />
                    ))}
                </div>
                {usernameError && (
                  <p className="text-sm text-red-500">{usernameError}</p>
                )}
              </div>

              <div className="w-full">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-1"
                >
                  Create a password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a secure password"
                    className="w-full mb-1 pr-16"
                    autoComplete="new-password"
                    required
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {password &&
                      (!passwordError ? (
                        <CheckCircle className="text-green-500" size={16} />
                      ) : (
                        <XCircle className="text-red-500" size={16} />
                      ))}
                  </div>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-500 mb-3">{passwordError}</p>
                )}
              </div>

              {processing ? (
                <div className="w-full mt-2">
                  <div className="flex items-center justify-center mb-2">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    <span>Uploading your data...</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    {progress.toFixed(2)}%
                  </div>
                </div>
              ) : (
                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={
                    !!usernameError ||
                    customUsername === '' ||
                    !!passwordError ||
                    password === ''
                  }
                >
                  Upload zip and Sign up
                </Button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
