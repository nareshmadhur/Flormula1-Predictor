export type ProfileActionState = {
  status?: 'success' | 'error'
  message?: string
}

export const initialProfileActionState: ProfileActionState = {}
