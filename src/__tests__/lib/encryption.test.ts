import { encryptToken, decryptToken } from '../../lib/encryption';

// Mock environment variable
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    TOKEN_ENCRYPTION_KEY: 'test-encryption-key-32-chars-long!!'
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('Token Encryption', () => {
  describe('encryptToken', () => {
    it('should encrypt a token successfully', () => {
      const plaintext = 'test-refresh-token-12345';
      const encrypted = encryptToken(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different encrypted values for the same input', () => {
      const plaintext = 'test-refresh-token-12345';
      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty token', () => {
      expect(() => encryptToken('')).toThrow('Cannot encrypt empty token');
    });

    it('should throw error when encryption key is missing', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      
      expect(() => encryptToken('test')).toThrow('TOKEN_ENCRYPTION_KEY environment variable is required');
    });
  });

  describe('decryptToken', () => {
    it('should decrypt a token successfully', () => {
      const plaintext = 'test-refresh-token-12345';
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle various token formats', () => {
      const tokens = [
        'simple-token',
        'token-with-numbers-123',
        'token.with.dots',
        'token_with_underscores',
        'very-long-token-with-many-characters-and-symbols-!@#$%^&*()',
      ];

      tokens.forEach(token => {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decryptToken('')).toThrow('Cannot decrypt empty data');
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decryptToken('invalid-base64-data')).toThrow();
    });

    it('should throw error for corrupted encrypted data', () => {
      const plaintext = 'test-token';
      const encrypted = encryptToken(plaintext);
      const corrupted = encrypted.slice(0, -5) + 'xxxxx';
      
      expect(() => decryptToken(corrupted)).toThrow();
    });
  });

  describe('encryption key handling', () => {
    it('should handle short encryption keys by hashing', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'short';
      
      const plaintext = 'test-token';
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long encryption keys by truncating', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'very-long-encryption-key-that-exceeds-32-characters-limit';
      
      const plaintext = 'test-token';
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });
});
