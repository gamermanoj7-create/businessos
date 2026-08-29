import { hashToken } from './token-hash.util';

describe('token-hash.util', () => {
  it('is deterministic for the same input', () => {
    const token = 'sample.raw.jwt.token';
    expect(hashToken(token)).toEqual(hashToken(token));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken('token-a')).not.toEqual(hashToken('token-b'));
  });

  it('never returns the raw token itself', () => {
    const token = 'sample.raw.jwt.token';
    expect(hashToken(token)).not.toEqual(token);
  });
});
