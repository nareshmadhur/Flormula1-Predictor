export type ScheduleImportActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export const initialScheduleImportActionState: ScheduleImportActionState = {
  status: 'idle',
  message: null,
}
