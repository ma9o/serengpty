'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Shield, Search, ChevronDown, Check } from 'lucide-react';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { saveUserProfile } from '../../actions/saveUserProfile';
import { UsernameStatus } from './username-status';
import { getUserProfile } from '../../actions/getUserProfile';
import { getIdenticon } from '@enclaveid/shared-browser';
import { z } from 'zod';
// UI Components
import { Button } from '@enclaveid/ui/button';
import { Input } from '@enclaveid/ui/input';
import { Switch } from '@enclaveid/ui/switch';
import { Card } from '@enclaveid/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@enclaveid/ui/avatar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@enclaveid/ui/form';
import { ConditionalWrapper } from '../conditional-wrapper';
import { userProfileSchema } from '../../schemas/validation';

// Initialize the countries library
countries.registerLocale(enLocale);

// Get all countries in the format we need
const ALL_COUNTRIES = [
  // Add Internet as default option
  {
    code: 'INTERNET',
    name: 'Internet',
    flag: '🌐',
  },
  ...Object.entries(countries.getNames('en'))
    .map(([code, name]) => {
      // Convert country code to flag emoji
      const flag = code
        .toUpperCase()
        .replace(/./g, (char) =>
          String.fromCodePoint(char.charCodeAt(0) + 127397)
        );

      return {
        code,
        name,
        flag,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
];

// We're using the centralized schema from validation.ts

export interface ProfileFormProps {
  isPreferences?: boolean;
}

// Create a completely redesigned CountrySelector component with custom dropdown
function CountrySelector({
  value,
  onChange,
  disabled,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onBlur?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find the selected country
  const selectedCountry = ALL_COUNTRIES.find(
    (country) => country.code === value
  );

  // Filter countries based on search term
  const filteredCountries = useMemo(() => {
    if (!searchTerm.trim()) return ALL_COUNTRIES;
    const term = searchTerm.toLowerCase();
    return ALL_COUNTRIES.filter((country) =>
      country.name.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    // Define the handler within the effect to ensure we capture the latest props
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        onBlur?.(); // Trigger onBlur when clicking outside
      }
    }

    if (isOpen) {
      // Only add the listener when the dropdown is open
      document.addEventListener('mousedown', handleClickOutside);

      // Focus the search input when dropdown opens
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else {
      // Clear search when dropdown closes
      setSearchTerm('');
    }

    // Clean up the event listener to prevent memory leaks
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onBlur, setIsOpen]); // Include all dependencies

  // Handle selecting a country
  const handleSelectCountry = (country: (typeof ALL_COUNTRIES)[0]) => {
    onChange(country.code);
    setIsOpen(false);
    onBlur?.(); // Trigger onBlur when selecting a country
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Custom trigger button */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className="w-full justify-between font-normal text-sm sm:text-base h-9 sm:h-10"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {selectedCountry ? (
          <span className="flex items-center">
            <span className="mr-2">{selectedCountry.flag}</span>
            {selectedCountry.name}
          </span>
        ) : (
          'Select your country'
        )}
        <ChevronDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50" />
      </Button>

      {/* Custom dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-48 sm:max-h-60 w-full overflow-auto rounded-md border border-input bg-background p-1 shadow-md">
          {/* Search box */}
          <div className="flex items-center border-b px-2 sm:px-3 py-1.5 sm:py-2 sticky top-0 bg-background">
            <Search className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-70" />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search countries..."
              className="border-0 bg-transparent p-1 text-xs sm:text-sm h-7 sm:h-8 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Country list */}
          <div className="pt-1 pb-1">
            {filteredCountries.length === 0 ? (
              <div className="relative flex w-full cursor-default select-none items-center rounded-sm py-1 sm:py-1.5 px-2 text-xs sm:text-sm outline-none text-muted-foreground">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country) => (
                <div
                  key={country.code}
                  className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1 sm:py-1.5 px-2 text-xs sm:text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground ${
                    value === country.code
                      ? 'bg-accent text-accent-foreground'
                      : ''
                  }`}
                  onClick={() => handleSelectCountry(country)}
                >
                  <span className="mr-1.5 sm:mr-2">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  {value === country.code && (
                    <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileForm({ isPreferences = false }: ProfileFormProps) {
  const { toast } = useToast();
  const [isUsernameValid, setIsUsernameValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedValues, setLastSavedValues] = useState<z.infer<
    typeof userProfileSchema
  > | null>(null);

  // Form setup
  const form = useForm<z.infer<typeof userProfileSchema>>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      username: '',
      country: 'INTERNET',
      sensitiveMatching: false,
    },
    mode: 'onChange',
  });

  // Function to save profile data to database
  const saveProfileData = useCallback(
    async (values: z.infer<typeof userProfileSchema>) => {
      // Skip saving if values haven't changed
      if (
        lastSavedValues &&
        lastSavedValues.username === values.username &&
        lastSavedValues.country === values.country &&
        lastSavedValues.sensitiveMatching === values.sensitiveMatching
      ) {
        return { success: true };
      }

      setIsSaving(true);
      try {
        // Call server action to save the profile
        const result = await saveUserProfile(values);

        if (result.success) {
          setLastSavedValues(values);
        } else {
          toast({
            title: 'Error',
            description:
              result.message ||
              'Failed to save your changes. Please try again.',
            variant: 'destructive',
            duration: 3000,
          });
        }
        return result;
      } catch (error) {
        console.error('Error saving profile data:', error);
        toast({
          title: 'Error',
          description: 'Failed to save your changes. Please try again.',
          variant: 'destructive',
          duration: 3000,
        });
        return { success: false, message: 'An error occurred while saving.' };
      } finally {
        setIsSaving(false);
      }
    },
    [lastSavedValues, toast]
  );

  // Watch form values for changes
  const watchedValues = form.watch();

  // Save on value change with debounce
  useEffect(() => {
    // Skip during initial load
    if (isLoading || isProfileLoading) return;

    // Validation check
    if (!isUsernameValid) return;

    // Handle fields changing
    const timer = setTimeout(() => {
      saveProfileData(watchedValues);
    }, 500); // Debounce for 500ms

    return () => {
      clearTimeout(timer);
    };
  }, [
    watchedValues,
    isUsernameValid,
    isLoading,
    isProfileLoading,
    saveProfileData,
  ]);

  // Fetch user profile data from database - only on initial mount
  useEffect(() => {
    // This should only run once on component mount
    let isMounted = true;

    async function fetchUserProfile() {
      try {
        if (isMounted) {
          setIsLoading(true);
          setIsProfileLoading(true);
        }

        const userData = await getUserProfile();

        if (userData && isMounted) {
          const profileData = {
            username: userData.name || '',
            country: userData.country || 'INTERNET',
            sensitiveMatching: userData.sensitiveMatching || false,
          };

          // Set the form values
          form.reset(profileData);
          setLastSavedValues(profileData);
          setIsUsernameValid(true);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        if (isMounted) {
          // Generate a fallback username in case of error
          form.setValue('username', `user_${Date.now().toString(36)}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsProfileLoading(false);
        }
      }
    }

    fetchUserProfile();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array as this should only run once on mount

  // Combined loading state
  const isFormLoading = isLoading || isProfileLoading;

  const watchUsername = form.watch('username');

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* User profile form */}
      <ConditionalWrapper
        condition={!isPreferences}
        wrapper={(children) => <Card className="p-3 sm:p-6">{children}</Card>}
      >
        <Form {...form}>
          <div className="space-y-4 sm:space-y-6">
            {/* Avatar/Identicon */}
            <div className="flex flex-col items-center mb-4 sm:mb-6">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 mb-2">
                <AvatarImage
                  src={getIdenticon(watchUsername)}
                  alt="User identicon"
                />
                <AvatarFallback>
                  {watchUsername.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Your unique identicon
              </p>
            </div>

            {/* Username field */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Username
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isFormLoading}
                      className="text-sm sm:text-base h-9 sm:h-10"
                      onBlur={() => {
                        field.onBlur();
                        if (isUsernameValid) {
                          saveProfileData(form.getValues());
                        }
                      }}
                    />
                  </FormControl>
                  <div className="flex flex-col space-y-1">
                    <FormDescription className="text-xs sm:text-sm">
                      This will be your display name in the system.
                    </FormDescription>
                    {!isFormLoading && (
                      <UsernameStatus
                        username={field.value}
                        isValid={isUsernameValid}
                        setIsValid={setIsUsernameValid}
                      />
                    )}
                  </div>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Country selector */}
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm sm:text-base">
                    Country
                  </FormLabel>
                  <FormControl>
                    <CountrySelector
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                      }}
                      onBlur={() => {
                        field.onBlur();
                        saveProfileData(form.getValues());
                      }}
                      disabled={isFormLoading || isSaving}
                    />
                  </FormControl>
                  <FormDescription className="text-xs sm:text-sm">
                    Select the country you&apos;re based in.
                  </FormDescription>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            {/* Sensitive matching toggle */}
            <FormField
              control={form.control}
              name="sensitiveMatching"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 sm:p-4">
                  <div className="space-y-0.5 max-w-[70%]">
                    <FormLabel className="text-sm sm:text-base">
                      Sensitive Matching
                    </FormLabel>
                    <FormDescription className="text-xs sm:text-sm">
                      Get deeper matches using your more sensitive and
                      embarrasing conversations (it&apos;s more fun!)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Shield
                        className={
                          field.value
                            ? 'text-primary h-3 w-3 sm:h-4 sm:w-4'
                            : 'text-muted-foreground h-3 w-3 sm:h-4 sm:w-4'
                        }
                      />
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          // Save immediately on toggle
                          setTimeout(() => {
                            saveProfileData({
                              ...form.getValues(),
                              sensitiveMatching: checked,
                            });
                          }, 0);
                        }}
                        disabled={isFormLoading || isSaving}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Form>
      </ConditionalWrapper>
    </div>
  );
}
