'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { AuthActionState } from '@/app/auth/action-state'
import { getAuthCallbackUrl, getSafeNextPath } from '@/utils/request-url'

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? '').trim().toLowerCase()
}

function getString(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

function isConfirmationError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('email not confirmed') || normalized.includes('not confirmed')
}

function mapAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (isConfirmationError(message)) {
    return 'Confirm your email before signing in. You can resend the confirmation below.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'That email and password combination did not match.'
  }

  if (normalized.includes('password')) {
    return 'We could not sign you in with that password.'
  }

  return message || 'Could not complete that request.'
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient()

  const email = normalizeEmail(formData.get('email'))
  const password = String(formData.get('password') ?? '')
  const next = getSafeNextPath(formData.get('next'))

  if (!email || !password) {
    return { error: 'Enter your email and password.', email }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      error: mapAuthError(error.message),
      email,
      canResendConfirmation: isConfirmationError(error.message),
    }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient()
  const email = normalizeEmail(formData.get('email'))
  const password = String(formData.get('password') ?? '')
  const displayName = getString(formData.get('display_name'))
  const next = getSafeNextPath(formData.get('next'))

  if (!displayName || !email || !password) {
    return { error: 'Fill in your name, email, and password.', email }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(next),
      data: {
        display_name: displayName,
      },
    },
  })

  if (error) {
    console.error('Signup error:', error)
    return { error: mapAuthError(error.message), email }
  }

  if (data.session || data.user?.email_confirmed_at) {
    revalidatePath('/', 'layout')
    redirect(next)
  }

  const alreadyExists =
    Array.isArray(data.user?.identities) && data.user.identities.length === 0

  return {
    email,
    canResendConfirmation: true,
    message: alreadyExists
      ? 'This email is already registered. Check your inbox for the confirmation email, or sign in if you already confirmed it.'
      : 'Check your email to confirm your account.',
  }
}

export async function resendConfirmation(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient()
  const email = normalizeEmail(formData.get('email'))
  const next = getSafeNextPath(formData.get('next'))

  if (!email) {
    return { error: 'Enter your email first.' }
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(next),
    },
  })

  if (error) {
    return {
      error: mapAuthError(error.message),
      email,
      canResendConfirmation: true,
    }
  }

  return {
    email,
    canResendConfirmation: true,
    message: 'Confirmation email sent again. Check your inbox and spam folder.',
  }
}

export async function forgotPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient()
  const email = normalizeEmail(formData.get('email'))

  if (!email) {
    return { error: 'Enter your email first.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthCallbackUrl('/reset-password'),
  })

  if (error) {
    return { error: mapAuthError(error.message), email }
  }

  return {
    email,
    message: 'Password reset link sent. Check your inbox and spam folder.',
  }
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const supabase = await createClient()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (!password || !confirmPassword) {
    return { error: 'Enter and confirm your new password.' }
  }

  if (password.length < 8) {
    return { error: 'Use at least 8 characters for your new password.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Those passwords do not match.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'Open the latest reset link from your email before setting a new password.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: mapAuthError(error.message) }
  }

  revalidatePath('/', 'layout')
  return {
    message: 'Password updated. You can head back to the grid with your new password.',
  }
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
