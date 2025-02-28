'use client';

import { OnboardingForm } from '../../../components/onboarding/onboarding-form';
import { Toaster } from '@enclaveid/ui/toaster';

export default function PreferencesPage() {
  return (
    <div className="flex-1">
      <OnboardingForm isPreferences={true} />
      <Toaster />
    </div>
  );
}