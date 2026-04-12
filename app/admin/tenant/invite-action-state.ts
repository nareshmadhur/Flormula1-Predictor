export type GroupInviteActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  inviteUrl?: string | null
}

export const initialGroupInviteActionState: GroupInviteActionState = {
  status: 'idle',
  message: null,
  inviteUrl: null,
}
