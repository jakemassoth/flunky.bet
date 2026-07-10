// Supabase returns PostgrestError/AuthError objects (not Error instances),
// so pull `.message` off any object that has it before falling back.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return String(e)
}

// Supabase raises this when a user tries to sign in before clicking the
// confirmation link. Prefer the stable `code`, but fall back to the message
// so we still catch it on older/edge responses.
export function isEmailNotConfirmed(e: unknown): boolean {
  if (e && typeof e === 'object' && (e as { code?: unknown }).code === 'email_not_confirmed') {
    return true
  }
  return /email not confirmed/i.test(errorMessage(e))
}
