'use client';

import { ProfileForm } from '../../../components/onboarding/profile-form';
import { Toaster } from '@enclaveid/ui/toaster';

export default function PreferencesPage() {
  return (
    <div className="flex h-full items-center px-2 sm:px-4">
      <ProfileForm isPreferences={true} />
      <Toaster />
    </div>
  );
}
