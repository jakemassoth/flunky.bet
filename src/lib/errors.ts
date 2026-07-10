// Supabase returns PostgrestError/AuthError objects (not Error instances),
// so pull `.message` off any object that has it before falling back.
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return String(e)
}
