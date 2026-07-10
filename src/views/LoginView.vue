<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorMessage } from '@/lib/errors'

const { signIn } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await signIn(email.value, password.value)
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
    <h2>Log in</h2>
    <form @submit.prevent="submit">
      <label>Email<input v-model="email" type="email" required /></label>
      <label>Password<input v-model="password" type="password" required /></label>
      <button :disabled="busy">Log in</button>
      <p v-if="error" class="err">{{ error }}</p>
    </form>
    <p class="muted">No account? <RouterLink to="/signup">Sign up</RouterLink></p>
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
  margin-top: 1rem;
}
</style>
