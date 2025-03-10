'use server';

import { z } from 'zod';

// Validation schema for password
const passwordSchema = z
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
    (password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    {
      message: 'Password must contain at least one special character.',
    }
  );

/**
 * Validates if a password meets complexity requirements
 */
export async function validatePassword(password: string): Promise<{
  isValid: boolean;
  message?: string;
}> {
  try {
    // Validate the password format
    const validationResult = passwordSchema.safeParse(password);
    if (!validationResult.success) {
      return {
        isValid: false,
        message: validationResult.error.errors[0].message,
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating password:', error);
    return {
      isValid: false,
      message: 'An error occurred while validating the password.',
    };
  }
}
