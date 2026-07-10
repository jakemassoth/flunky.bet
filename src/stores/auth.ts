import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const displayName = ref('')

  const isAuthed = computed(() => !!session.value)

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

  async function init() {
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

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
    if (error) throw error
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { session, user, displayName, isAuthed, init, signUp, signIn, signOut }
})
