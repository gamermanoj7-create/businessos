import * as argon2 from 'argon2';

// Argon2id is the current OWASP-recommended default: resistant to both
// GPU-cracking and side-channel attacks. Parameters below follow the
// OWASP Password Storage Cheat Sheet baseline recommendation.
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // Malformed hash or verification failure — treat as non-match, never throw.
    return false;
  }
}
