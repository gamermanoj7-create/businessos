import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes a password to an argon2id string, not plaintext', async () => {
    const hash = await hashPassword('S3curePass!23');
    expect(hash).not.toEqual('S3curePass!23');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('S3curePass!23');
    await expect(verifyPassword(hash, 'S3curePass!23')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('S3curePass!23');
    await expect(verifyPassword(hash, 'WrongPassword1')).resolves.toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hashA = await hashPassword('S3curePass!23');
    const hashB = await hashPassword('S3curePass!23');
    expect(hashA).not.toEqual(hashB);
  });

  it('returns false (not throw) for a malformed hash', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});
