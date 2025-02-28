'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { FileArchive, Loader2, XCircle } from 'lucide-react';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Toaster } from '@enclaveid/ui/toaster';
import { processZipFile } from '../../utils/clientZipUtils';
import MageRobotHappy from '~icons/mage/robot-happy';

/**
 * generatePassword function for client-side password generation.
 */
function generatePassword(length = 24): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let retVal = '';
  for (let i = 0; i < length; i++) {
    retVal += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return retVal;
}

/**
 * ZipOnboardingForm component wraps the ZipDropzone.
 * When a file is dropped, we process it on the client side,
 * generate a password, update UI feedback statuses, and then
 * reveal a sign-up button that will handle the final sign-up with just the cleaned conversations data.
 */
export function ZipOnboardingForm() {
  const { toast } = useToast();

  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cleanedConversations, setCleanedConversations] = useState<any>(null);

  async function handleFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;

    // Reset state for a new upload.
    setError('');
    setStatus('Processing archive...');
    setProcessing(true);
    setReady(false);
    setPassword(null);
    setCleanedConversations(null);

    // Record the start time to ensure minimum loading duration
    const startTime = Date.now();

    try {
      // Process the zip file on the client side
      setStatus('Extracting and cleaning data...');
      const result = await processZipFile(file);

      if (!result.success || !result.conversations) {
        setError('Failed to process the archive.');
        setProcessing(false);
        return;
      }

      setCleanedConversations(result.conversations);

      // Ensure minimum loading time before showing password
      await ensureMinimumLoadingTime(startTime);

      setStatus('Generating password...');
      // Generate a strong password on the client.
      const newPassword = generatePassword();
      setPassword(newPassword);
      setStatus('All done! You are now ready to sign up.');
      setReady(true);
    } catch (err) {
      console.error(err);
      setError('An error occurred during processing.');
    } finally {
      setProcessing(false);
    }
  }

  // Helper function to ensure loading state lasts at least 2 seconds
  async function ensureMinimumLoadingTime(startTime: number) {
    const minLoadingTime = 2000; // 2 seconds in milliseconds
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < minLoadingTime) {
      return new Promise((resolve) =>
        setTimeout(resolve, minLoadingTime - elapsedTime)
      );
    }
    return Promise.resolve(); // Always return a promise for consistent behavior
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!cleanedConversations || !password) {
      setError('Missing required data for submission.');
      return;
    }

    // Record the start time to ensure minimum loading duration
    const startTime = Date.now();

    try {
      setStatus('Creating your account...');
      setProcessing(true);

      // Create FormData with only the cleaned data
      const formData = new FormData();
      // Only add the cleaned conversations.json data to the form
      formData.append('conversations', JSON.stringify(cleanedConversations));
      formData.append('password', password);

      // Send the data to our signup API
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      // Get the response
      const data = await response.json();

      // Success - redirect to login page
      toast({
        title: 'Account created!',
        description:
          'Your account has been created successfully. You can now log in.',
        duration: 5000,
      });

      // Redirect to login page after a short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setProcessing(false);
    }
  }

  // Set up the dropzone directly in this component
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
    disabled: processing,
    // This ensures the dropzone is always ready to accept new files
    noClick: ready,
    noKeyboard: ready,
    noDrag: ready,
  });

  return (
    <div className="onboarding-form p-4 w-1/2 h-[200px]">
      <Toaster />

      <form onSubmit={handleSubmit}>
        {/* When processing is complete, show the sign-up button */}
        {!ready ? (
          <div>
            {/* Robot icon message */}
            {!processing && (
              <div className="mb-2 flex items-center justify-center">
                <MageRobotHappy
                  width="24"
                  height="24"
                  className="text-gray-500 mr-2"
                />
                <p className="text-sm text-gray-500 font-medium">
                  Your data will be anonymized before uploading
                </p>
              </div>
            )}

            {/* Processing indicator or Dropzone */}
            {processing ? (
              <div className="w-full mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center">
                  <MageRobotHappy width="24" height="24" className=" mb-2" />
                  <div className="flex items-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    <span className="">We're anonymizing the data...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className="relative w-full mb-8 md:mb-0 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center text-center hover:border-green-800 transition-colors cursor-pointer"
              >
                <input {...getInputProps()} />
                <svg
                  className="w-12 h-12 text-gray-400 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 16l8-8m0 0l8 8m-8-8v24"
                  />
                </svg>
                <p className="mt-2 text-base text-gray-500">
                  Upload your conversations archive zip here
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Only *.zip files are accepted
                </p>
              </div>
            )}

            {/* Error feedback with robot */}
            {error && (
              <div className="mt-4 text-red-600 flex items-center">
                <MageRobotHappy
                  width="24"
                  height="24"
                  className="text-red-500 mr-2"
                />
                <XCircle className="mr-2" size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-4">
              <FileArchive className="mb-4 text-gray-700" size={32} />
              <p className="text-md text-gray-700 mb-4 w-[400px]">
                Your archive is ready to be uploaded!
              </p>
            </div>

            <label
              htmlFor="password"
              className="text-md text-gray-700 mb-4 w-[470px]"
            >
              Here is the <span className="font-bold">password</span> for your
              account.
              <br />
              For anonymity reasons, this will be the only identifier for your
              account which you will use to login.{' '}
              <span className="font-bold">Do not lose it!</span>
            </label>
            {password && (
              <div className="flex items-center justify-center gap-4">
                <div className="space-y-2">
                  <div className="relative w-[300px]">
                    <Input
                      id="password"
                      name="password"
                      type="text"
                      value={password}
                      readOnly
                      className="font-mono w-full"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        navigator.clipboard.writeText(password);
                        toast({
                          description: 'Password copied to clipboard',
                          duration: 2000,
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <Button type="submit">Upload and Sign Up</Button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
