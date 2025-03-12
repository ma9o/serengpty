'use server';

import { passwordSchema } from '../schemas/validation';

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
