export type ManualResultsActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export const initialManualResultsActionState: ManualResultsActionState = {
  status: 'idle',
  message: null,
}
