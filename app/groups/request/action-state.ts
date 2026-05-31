export type GroupRequestActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export const initialGroupRequestActionState: GroupRequestActionState = {
  status: 'idle',
  message: null,
}
