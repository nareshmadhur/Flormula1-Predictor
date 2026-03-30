export type TenantAdminActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export const initialTenantAdminActionState: TenantAdminActionState = {
  status: 'idle',
  message: null,
}
