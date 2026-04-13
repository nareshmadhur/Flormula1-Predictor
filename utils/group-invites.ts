import crypto from 'crypto'

export function generateInviteToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function hashInviteToken(token: string) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}

export function getInvitePath(token: string) {
  return `/join/${encodeURIComponent(token)}`
}

export function getInviteClaimPath(token: string) {
  return `/join/${encodeURIComponent(token)}/claim`
}
