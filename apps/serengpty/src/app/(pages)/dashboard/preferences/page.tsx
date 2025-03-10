'use client';

import { ProfileForm } from '../../../components/onboarding/profile-form';
import { Toaster } from '@enclaveid/ui/toaster';

export default function PreferencesPage() {
  return (
    <div className="flex h-full items-center">
      <ProfileForm isPreferences={true} />
      <Toaster />
    </div>
  );
}
