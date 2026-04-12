export type JoinInviteActionState = {
  status: 'idle' | 'error'
  message: string | null
}

export const initialJoinInviteActionState: JoinInviteActionState = {
  status: 'idle',
  message: null,
}
