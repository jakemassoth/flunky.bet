<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorMessage, isEmailNotConfirmed } from '@/lib/errors'

const { signIn, resendConfirmation } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

// Set when the login fails only because the address hasn't been confirmed yet.
const needsConfirmation = ref(false)
const resending = ref(false)
const resent = ref(false)
const resendError = ref('')

async function submit() {
  error.value = ''
  needsConfirmation.value = false
  busy.value = true
  try {
    await signIn(email.value, password.value)
    router.push({ name: 'markets' })
  } catch (e: unknown) {
    if (isEmailNotConfirmed(e)) {
      needsConfirmation.value = true
    } else {
      error.value = errorMessage(e)
    }
  } finally {
    busy.value = false
  }
}

async function resend() {
  resendError.value = ''
  resent.value = false
  resending.value = true
  try {
    await resendConfirmation(email.value)
    resent.value = true
  } catch (e: unknown) {
    resendError.value = errorMessage(e)
  } finally {
    resending.value = false
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

    <!-- Unconfirmed email: explain what's wrong and offer to resend the link. -->
    <div
      v-if="needsConfirmation"
      class="mt-3 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm"
    >
      <p class="flex items-start gap-2">
        <span class="shrink-0" aria-hidden="true">📬</span>
        <span>Confirm your email first. We sent a link to
          <span class="font-semibold break-words">{{ email }}</span> — click it to activate your
          account, then log in.</span
        >
      </p>
      <p v-if="resent" class="mt-2 text-accent">Confirmation email sent again.</p>
      <p v-if="resendError" class="mt-2 text-danger">{{ resendError }}</p>
      <button class="btn btn-ghost mt-3 w-full" :disabled="resending" @click="resend">
        {{ resending ? 'Resending…' : 'Resend confirmation email' }}
      </button>
    </div>

    <p class="mt-4 text-muted">
      No account? <RouterLink to="/signup" class="text-accent hover:underline">Sign up</RouterLink>
    </p>
  </section>
</template>
