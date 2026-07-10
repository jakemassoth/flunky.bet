import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Auth session is genuine client state (not server state), so it stays a small
// module-level singleton rather than a TanStack query.
const session = ref<Session | null>(null)
const user = ref<User | null>(null)
const displayName = ref('')

async function loadProfile() {
  if (!user.value) {
    displayName.value = ''
    return
  }
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.value.id)
    .single()
  displayName.value = data?.display_name ?? ''
}

let started = false

// Resolve the session once, before the app mounts, so the router guard sees it.
export async function initAuth() {
  if (started) return
  started = true
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  user.value = data.session?.user ?? null
  await loadProfile()

  supabase.auth.onAuthStateChange((_event, s) => {
    session.value = s
    user.value = s?.user ?? null
    void loadProfile()
  })
}

export function useAuth() {
  const isAuthed = computed(() => !!session.value)

  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
    if (error) throw error
    // When email confirmation is enabled, Supabase creates the user but returns
    // no session — they must click the emailed link first. When it's disabled a
    // session comes back and they're signed in instantly. The caller uses this
    // to decide between the "check your inbox" screen and routing into the app.
    return { needsEmailConfirmation: !data.session }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  // Re-send the sign-up confirmation link, e.g. from the "check your inbox"
  // screen or when an unconfirmed user tries to log in.
  async function resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return {
    session,
    user,
    displayName,
    isAuthed,
    signUp,
    signIn,
    resendConfirmation,
    signOut,
  }
}
