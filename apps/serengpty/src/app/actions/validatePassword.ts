'use server';

import { validatePassword as validatePasswordUtil } from '@enclaveid/shared-utils';

/**
 * Validates if a password meets complexity requirements
 */
export async function validatePassword(password: string): Promise<{
  isValid: boolean;
  message?: string;
}> {
  try {
    // Validate the password format
    const validationResult = validatePasswordUtil(password);
    if (!validationResult.isValid) {
      return validationResult;
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
