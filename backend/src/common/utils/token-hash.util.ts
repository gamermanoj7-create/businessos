import { createHash } from 'crypto';

// Refresh tokens are high-entropy random JWTs (unlike user passwords), so a
// fast cryptographic hash is appropriate here — Argon2's slow, memory-hard
// design is unnecessary and only adds latency for this use case. We still
// never store the raw refresh token, only this hash, so a database leak
// alone does not let an attacker forge sessions.
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
