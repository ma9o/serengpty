'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@enclaveid/ui/hooks/use-toast';
import { Save, Shield } from 'lucide-react';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { useState, useMemo, useEffect } from 'react';
import { generateUniqueUsername } from '../../actions/validateUsername';
import { saveUserProfile } from '../../actions/saveUserProfile';
import { UsernameStatus } from './username-status';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@enclaveid/ui/select';
import { getIdenticon } from '../../utils/getIdenticon';

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

// Form validation schema
const formSchema = z.object({
  username: z
    .string()
    .min(3, {
      message: 'Username must be at least 3 characters.',
    })
    .max(20, {
      message: 'Username cannot be longer than 20 characters.',
    }),
  country: z.string({
    required_error: 'Please select a country.',
  }),
  sensitiveMatching: z.boolean().default(false),
});

export function OnboardingForm() {
  const { toast } = useToast();
  const [countrySearch, setCountrySearch] = useState('');
  const [isUsernameValid, setIsUsernameValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return ALL_COUNTRIES;
    const searchTerm = countrySearch.toLowerCase();
    return ALL_COUNTRIES.filter((country) =>
      country.name.toLowerCase().includes(searchTerm)
    );
  }, [countrySearch]);

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      country: 'INTERNET',
      sensitiveMatching: false,
    },
  });

  // Get a unique username from the server
  useEffect(() => {
    async function fetchUniqueUsername() {
      try {
        const username = await generateUniqueUsername();
        form.setValue('username', username);
        setIsUsernameValid(true);
      } catch (error) {
        console.error('Error generating username:', error);
        form.setValue('username', `user_${Date.now().toString(36)}`);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUniqueUsername();
  }, [form]);

  const watchUsername = form.watch('username');

  // Form submission handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Prevent submission if username is invalid
      if (!isUsernameValid) {
        toast({
          title: 'Invalid username',
          description: 'Please choose a valid username before submitting.',
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      // Call server action to save the profile
      const result = await saveUserProfile(values);
      
      if (result.success) {
        toast({
          title: 'Profile saved!',
          description: 'Your profile has been created successfully.',
          duration: 3000,
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to save your profile. Please try again.',
          variant: 'destructive',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your profile. Please try again.',
        variant: 'destructive',
        duration: 3000,
      });
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* User profile form */}
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar/Identicon */}
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-24 w-24 mb-2">
                <AvatarImage
                  src={getIdenticon(watchUsername)}
                  alt="User identicon"
                />
                <AvatarFallback>
                  {watchUsername.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm text-muted-foreground">
                Your unique identicon
              </p>
            </div>

            {/* Username field */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isLoading} />
                  </FormControl>
                  <div className="flex flex-col space-y-1">
                    <FormDescription>
                      This will be your display name in the system.
                    </FormDescription>
                    {!isLoading && (
                      <UsernameStatus
                        username={field.value}
                        isValid={isUsernameValid}
                        setIsValid={setIsUsernameValid}
                      />
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country selector */}
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Search countries..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="mb-2"
                        />
                      </div>
                      {filteredCountries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <span className="flex items-center">
                            <span className="mr-2">{country.flag}</span>
                            {country.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the country you're based in.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sensitive matching toggle */}
            <FormField
              control={form.control}
              name="sensitiveMatching"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Sensitive Matching
                    </FormLabel>
                    <FormDescription>
                      Enable deeper matching for sensitive data patterns.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <Shield
                        className={
                          field.value
                            ? 'text-primary h-4 w-4'
                            : 'text-muted-foreground h-4 w-4'
                        }
                      />
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Save button */}
            <Button type="submit" className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Profile
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
