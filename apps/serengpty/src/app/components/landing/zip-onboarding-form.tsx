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
import { getCurrentUser } from '../../actions/getCurrentUser';
import axios from 'axios';

export function ZipOnboardingForm() {
  const { toast } = useToast();
  const [user, setUser] = useState<Awaited<ReturnType<typeof getCurrentUser>> | null>(null);

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
  // New states to track signup and upload phases
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished) {
      window.location.href = '/onboarding';
    }
  }, [finished]);
  
  useEffect(() => {
    const fetchUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  async function handleFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;

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
      const result = await processZipFile(file, (progressValue) => {
        setProgress(progressValue); // Progress from 0 to 100 for processing
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

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customUsername) {
        const result = await validateUsername(customUsername);
        setUsernameError(
          result.isValid ? '' : result.message || 'Username is invalid'
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [customUsername]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (password) {
        const result = await validatePassword(password);
        setPasswordError(
          result.isValid ? '' : result.message || 'Password is invalid'
        );
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
    setUsernameError(
      result.isValid ? '' : result.message || 'Username is invalid'
    );
    return result.isValid;
  };

  const validateUserPassword = async () => {
    if (!password.trim()) {
      setPasswordError('Password is required');
      return false;
    }
    const result = await validatePassword(password);
    setPasswordError(
      result.isValid ? '' : result.message || 'Password is invalid'
    );
    return result.isValid;
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!cleanedConversations) {
      setError('Missing conversation data for submission.');
      return;
    }

    if (
      !(await validateCustomUsername(customUsername)) ||
      !(await validateUserPassword())
    ) {
      return;
    }

    setProcessing(true);
    setIsSigningUp(true);

    try {
      const formData = new FormData();
      formData.append('password', password);
      formData.append('username', customUsername);
      if (providerName) formData.append('providerName', providerName);

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to sign up',
        });
        setProcessing(false);
        setIsSigningUp(false);
        return;
      }

      setIsSigningUp(false);

      if (data.uploadUrl) {
        setIsUploading(true);
        setProgress(0); // Reset progress for upload

        const conversationsData = JSON.stringify(cleanedConversations);
        // Create a Blob from the JSON data to upload it in a single request.
        const blob = new Blob([conversationsData], {
          type: 'application/json',
        });

        // Upload data using axios with onUploadProgress for progress tracking.
        await axios.put(data.uploadUrl, blob, {
          headers: {
            'Content-Type': 'application/json',
            'x-ms-blob-type': 'BlockBlob',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progressPercent = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100
              );
              setProgress(progressPercent);
            }
          },
        });

        setProgress(100); // Ensure complete progress update
        setIsUploading(false);
        setFinished(true);
      }
    } catch (err) {
      console.error(err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred during sign up.';
      toast({ title: 'Error', description: errorMessage });
    } finally {
      setProcessing(false);
      setIsSigningUp(false);
      setIsUploading(false);
    }
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/octet-stream': ['.dms'],
    },
    multiple: false,
    disabled: processing,
    noClick: ready,
    noKeyboard: ready,
    noDrag: ready,
  });

  // If user is already logged in, show a message
  if (user) {
    return (
      <div className="onboarding-form w-full md:w-1/2 flex justify-center px-4 sm:px-0">
        <Toaster />
        <div className="w-full max-w-md border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center">
          <Icon
            icon="mage:robot-happy"
            width="32"
            height="32"
            className="text-gray-700 mb-4"
          />
          <p className="text-lg font-medium text-gray-700">
            You&apos;ve already uploaded your archive
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Visit your dashboard to explore conversations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-form w-full md:w-1/2 flex justify-center px-4 sm:px-0">
      <Toaster />
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        {!ready ? (
          <div>
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
                      Your data will be anonymized locally before being uploaded
                    </p>
                  </>
                )
              )}
            </div>
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
                    <span>Processing your archive...</span>
                  </div>
                  <div className="w-full mt-2 max-w-md">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {progress}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className="relative w-full md:w-[400px] mx-auto mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center hover:border-green-800 transition-colors cursor-pointer"
              >
                <input {...getInputProps()} />
                <p className="mt-2 text-base text-gray-500">
                  Drop your data export archive here
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Only *.zip and *.dms files are accepted
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-3 w-full px-4 sm:px-0">
              <FileArchive className="text-gray-700 mb-4 h-10 w-10 sm:h-8 sm:w-8" />
              <p className="text-md text-gray-700 mb-4 max-w-[400px]">
                Your
                <span className="font-bold">
                  {providerName === 'anthropic' ? ' Claude ' : ' ChatGPT '}
                </span>
                archive is ready to be uploaded!
              </p>
            </div>
            <div className="flex flex-col items-center gap-4 w-full max-w-[470px]">
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"
                        size={16}
                      />
                    ) : (
                      <XCircle
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"
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
                  {isSigningUp ? (
                    <div className="flex items-center justify-center mb-2">
                      <Loader2 className="animate-spin mr-2" size={16} />
                      <span>Creating account...</span>
                    </div>
                  ) : isUploading ? (
                    <div className="flex flex-col items-center w-full">
                      <div className="flex items-center mb-2">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        <span>Uploading data...</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {progress.toFixed(2)}%
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={
                    !!usernameError ||
                    !customUsername ||
                    !!passwordError ||
                    !password
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