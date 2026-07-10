<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorMessage } from '@/lib/errors'

const { signUp } = useAuth()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await signUp(email.value, password.value, displayName.value)
    router.push({ name: 'markets' })
  } catch (e: unknown) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="auth">
    <h2>Sign up</h2>
    <p class="muted">You get 200 flunky credits. No email confirmation — you're in instantly.</p>
    <form @submit.prevent="submit">
      <label>Display name<input v-model="displayName" type="text" required /></label>
      <label>Email<input v-model="email" type="email" required /></label>
      <label>Password<input v-model="password" type="password" minlength="6" required /></label>
      <button :disabled="busy">Sign up</button>
      <p v-if="error" class="err">{{ error }}</p>
    </form>
    <p class="muted">Have an account? <RouterLink to="/login">Log in</RouterLink></p>
  </section>
</template>

<style scoped>
.auth {
  max-width: 320px;
  margin: 2rem auto;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}
.err {
  color: #ff6b6b;
  font-size: 0.85rem;
}
.muted {
  color: var(--muted);
  margin: 0.5rem 0 1rem;
}
</style>
