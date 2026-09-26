/**
 * Formats raw Supabase or Auth API error objects into user-friendly guidance.
 */
export function formatAuthError(error: any): string {
  if (!error) return 'An unexpected authentication error occurred.';

  const rawMsg = typeof error === 'string'
    ? error
    : (error.message || error.error_description || error.msg || '');

  const msgLower = rawMsg.toLowerCase();

  if (!rawMsg) return 'An unexpected authentication error occurred.';

  // 1. Invalid credentials
  if (
    msgLower.includes('invalid login credentials') ||
    msgLower.includes('invalid_credentials') ||
    msgLower.includes('invalid email or password') ||
    msgLower.includes('invalid_grant')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  // 2. User already exists / registered
  if (
    msgLower.includes('user already registered') ||
    msgLower.includes('user already exists') ||
    msgLower.includes('user_already_exists') ||
    msgLower.includes('already registered')
  ) {
    return 'An account with this email address already exists. Please sign in instead.';
  }

  // 3. Email not confirmed
  if (
    msgLower.includes('email not confirmed') ||
    msgLower.includes('email_not_confirmed')
  ) {
    return 'Please verify your email address before signing in. Check your inbox for the confirmation link.';
  }

  // 4. Password short
  if (
    msgLower.includes('should be at least 6 characters') ||
    msgLower.includes('at least 6 characters') ||
    msgLower.includes('password length')
  ) {
    return 'Password must be at least 6 characters long.';
  }

  // 5. Rate limiting
  if (
    msgLower.includes('rate limit') ||
    msgLower.includes('too many requests') ||
    msgLower.includes('over_email_send_rate_limit') ||
    msgLower.includes('over_request_rate_limit')
  ) {
    return 'Too many authentication attempts. Please wait a few moments before trying again.';
  }

  // 6. Invalid email format
  if (
    msgLower.includes('invalid email') ||
    msgLower.includes('unable to validate email') ||
    msgLower.includes('email format')
  ) {
    return 'Please enter a valid email address format (e.g. name@domain.com).';
  }

  // 7. Network / Connectivity
  if (
    msgLower.includes('failed to fetch') ||
    msgLower.includes('networkerror') ||
    msgLower.includes('network request failed') ||
    msgLower.includes('offline')
  ) {
    return 'Unable to connect to the authentication server. Please check your internet connection.';
  }

  // 8. Signups disabled
  if (
    msgLower.includes('signup_disabled') ||
    msgLower.includes('signups are disabled')
  ) {
    return 'New user registration is currently disabled on this server.';
  }

  // Clean technical prefixes
  const cleanedMsg = rawMsg
    .replace(/^AuthApiError:\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();

  if (cleanedMsg.length > 0) {
    const formatted = cleanedMsg.charAt(0).toUpperCase() + cleanedMsg.slice(1);
    return formatted.endsWith('.') ? formatted : `${formatted}.`;
  }

  return 'An error occurred during authentication. Please try again.';
}
