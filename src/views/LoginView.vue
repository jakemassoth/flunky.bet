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
  <section class="mx-auto mt-8 max-w-xs">
    <h2 class="text-lg font-semibold">Log in</h2>
    <form class="mt-4 flex flex-col gap-3" @submit.prevent="submit">
      <label class="flex flex-col gap-1 text-sm"
        >Email<input class="field" v-model="email" type="email" required
      /></label>
      <label class="flex flex-col gap-1 text-sm"
        >Password<input class="field" v-model="password" type="password" required
      /></label>
      <button class="btn" :disabled="busy">{{ busy ? 'Logging in…' : 'Log in' }}</button>
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </form>

    <p class="mt-4 text-muted">
      No account? <RouterLink to="/signup" class="text-accent hover:underline">Sign up</RouterLink>
    </p>
  </section>
</template>
