export type AuthActionState = {
  error?: string
  message?: string
  email?: string
  canResendConfirmation?: boolean
}

export const initialAuthActionState: AuthActionState = {}
