export type TestModeTenantRef = {
  is_test?: boolean | null
}

export type TestModeProfileRef = {
  is_test?: boolean | null
  tenants?: TestModeTenantRef | TestModeTenantRef[] | null
}

export function getProfileTenantRef(profile: TestModeProfileRef | null | undefined) {
  const tenant = profile?.tenants

  if (Array.isArray(tenant)) {
    return tenant[0] || null
  }

  return tenant || null
}

export function isTestModeProfile(profile: TestModeProfileRef | null | undefined) {
  return Boolean(profile?.is_test || getProfileTenantRef(profile)?.is_test)
}
