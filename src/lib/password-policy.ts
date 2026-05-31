export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include at least one letter and one number';

export function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: PASSWORD_POLICY_MESSAGE };
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, error: PASSWORD_POLICY_MESSAGE };
  }

  return { valid: true };
}

