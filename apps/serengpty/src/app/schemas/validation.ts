import { z } from 'zod';

/**
 * Username validation schema
 * - 3-20 characters
 * - Letters, numbers, underscores only
 */
export const usernameSchema = z
  .string()
  .min(3, { message: 'Username must be at least 3 characters.' })
  .max(20, { message: 'Username cannot be longer than 20 characters.' })
  .regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  });

/**
 * Password validation schema
 * - 8-64 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long.' })
  .max(64, { message: 'Password cannot be longer than 64 characters.' })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter.',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter.',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one number.',
  })
  .refine(
    (password) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    {
      message: 'Password must contain at least one special character.',
    }
  );

/**
 * Country code schema
 */
export const countrySchema = z.string({
  required_error: 'Please select a country.',
});

/**
 * User profile form schema
 */
export const userProfileSchema = z.object({
  username: usernameSchema,
  country: countrySchema,
  sensitiveMatching: z.boolean().default(false),
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;