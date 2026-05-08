export type GroupMemberActionState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

export const initialGroupMemberActionState: GroupMemberActionState = {
  status: 'idle',
}
