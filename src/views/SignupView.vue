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
  <section class="mx-auto mt-8 max-w-xs">
    <h2 class="text-lg font-semibold">Sign up</h2>
    <p class="mt-2 mb-4 text-muted">
      You get 200 flunky credits. No email confirmation — you're in instantly.
    </p>
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <label class="flex flex-col gap-1 text-sm"
        >Display name<input class="field" v-model="displayName" type="text" required
      /></label>
      <label class="flex flex-col gap-1 text-sm"
        >Email<input class="field" v-model="email" type="email" required
      /></label>
      <label class="flex flex-col gap-1 text-sm"
        >Password<input class="field" v-model="password" type="password" minlength="6" required
      /></label>
      <button class="btn" :disabled="busy">Sign up</button>
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </form>
    <p class="mt-4 text-muted">
      Have an account? <RouterLink to="/login" class="text-accent hover:underline">Log in</RouterLink>
    </p>
  </section>
</template>
