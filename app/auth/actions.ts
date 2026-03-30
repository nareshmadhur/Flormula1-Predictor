'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    const errorMessage =
      error.message.toLowerCase().includes('email not confirmed')
        ? 'Check your email and confirm your account before signing in.'
        : error.message || 'Could not authenticate user.'

    redirect(`/login?error=${encodeURIComponent(errorMessage)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/predictions')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        display_name: formData.get('display_name') as string,
      }
    }
  }

  const headersList = await headers()
  const origin = headersList.get('origin') || 'http://localhost:3000'

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        display_name: data.options.data.display_name,
      }
    }
  })

  if (error) {
    console.error('Signup error:', error)
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/signup?message=Check email to continue')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
