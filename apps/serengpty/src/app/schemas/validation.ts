import { z } from 'zod';
import { usernameSchema, passwordSchema } from '@enclaveid/shared-utils';

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