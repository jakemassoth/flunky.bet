<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorMessage } from '@/lib/errors'

const { signUp, resendConfirmation } = useAuth()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

// After a successful sign-up that needs confirmation we swap the form for a
// prominent "check your inbox" screen instead of routing into the app.
const awaitingConfirmation = ref(false)
const submittedEmail = ref('')

// Resend state for the confirmation screen.
const resending = ref(false)
const resent = ref(false)
const resendError = ref('')

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const { needsEmailConfirmation } = await signUp(email.value, password.value, displayName.value)
    if (needsEmailConfirmation) {
      submittedEmail.value = email.value
      awaitingConfirmation.value = true
    } else {
      // Confirmation disabled: the session is live, go straight into the app.
      router.push({ name: 'markets' })
    }
  } catch (e: unknown) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function resend() {
  resendError.value = ''
  resent.value = false
  resending.value = true
  try {
    await resendConfirmation(submittedEmail.value)
    resent.value = true
  } catch (e: unknown) {
    resendError.value = errorMessage(e)
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <!-- Confirmation screen: shown once sign-up succeeds and an email is pending. -->
  <section v-if="awaitingConfirmation" class="mx-auto mt-8 max-w-sm">
    <div class="rounded-lg border border-accent/40 bg-accent/10 p-5 text-center sm:p-6">
      <div class="text-4xl" aria-hidden="true">📬</div>
      <h2 class="mt-3 text-xl font-semibold">Check your inbox!</h2>
      <p class="mt-3 text-sm">
        We sent a confirmation link to
        <span class="font-semibold break-words text-accent">{{ submittedEmail }}</span
        >. Click it to activate your account and claim your
        <span class="font-semibold text-accent">200 flunky credits</span>.
      </p>
      <p class="mt-3 text-sm text-muted">
        You'll need to confirm before you can log in. It can take a minute to arrive —
        don't forget to check your spam folder.
      </p>
    </div>

    <div class="mt-4 flex flex-col items-center gap-2 text-center">
      <p v-if="resent" class="text-sm text-accent">Sent again — check your inbox.</p>
      <p v-if="resendError" class="text-sm text-danger">{{ resendError }}</p>
      <button class="btn btn-ghost w-full" :disabled="resending" @click="resend">
        {{ resending ? 'Resending…' : "Didn't get it? Resend email" }}
      </button>
      <p class="mt-1 text-sm text-muted">
        Already confirmed?
        <RouterLink to="/login" class="text-accent hover:underline">Log in</RouterLink>
      </p>
    </div>
  </section>

  <!-- Sign-up form -->
  <section v-else class="mx-auto mt-8 max-w-xs">
    <h2 class="text-lg font-semibold">Sign up</h2>
    <p class="mt-2 mb-4 text-muted">Get 200 flunky credits and start betting.</p>
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
      <p class="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-muted">
        <span class="shrink-0 text-sm" aria-hidden="true">✉️</span>
        <span>We'll email you a confirmation link — click it to activate your account before your first log in.</span>
      </p>
      <button class="btn" :disabled="busy">{{ busy ? 'Signing up…' : 'Sign up' }}</button>
      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </form>
    <p class="mt-4 text-muted">
      Have an account? <RouterLink to="/login" class="text-accent hover:underline">Log in</RouterLink>
    </p>
  </section>
</template>
