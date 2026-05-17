import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateJwtKeyPair,
  loadKeyPairFromEnv,
  loadOrGenerateKeyPair,
  getJwtKeyPair,
  validateKeyPair,
} from './jwt-keys';

const ORIG_PRIVATE = process.env.JWT_PRIVATE_KEY;
const ORIG_PUBLIC = process.env.JWT_PUBLIC_KEY;

function restoreEnv(): void {
  if (ORIG_PRIVATE === undefined) delete process.env.JWT_PRIVATE_KEY;
  else process.env.JWT_PRIVATE_KEY = ORIG_PRIVATE;
  if (ORIG_PUBLIC === undefined) delete process.env.JWT_PUBLIC_KEY;
  else process.env.JWT_PUBLIC_KEY = ORIG_PUBLIC;
}

describe('generateJwtKeyPair', () => {
  it('returns a PEM RSA key pair', () => {
    const { privateKey, publicKey } = generateJwtKeyPair();
    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
  });

  it('respects an explicit modulus length', () => {
    const small = generateJwtKeyPair({ modulusLength: 2048 });
    expect(small.privateKey.length).toBeGreaterThan(100);
  });
});

describe('loadKeyPairFromEnv', () => {
  afterEach(() => restoreEnv());

  it('reads PEM keys directly from env', () => {
    const generated = generateJwtKeyPair();
    process.env.JWT_PRIVATE_KEY = generated.privateKey;
    process.env.JWT_PUBLIC_KEY = generated.publicKey;
    const loaded = loadKeyPairFromEnv();
    expect(loaded.privateKey).toBe(generated.privateKey);
    expect(loaded.publicKey).toBe(generated.publicKey);
  });

  it('base64-decodes keys that are not PEM-prefixed', () => {
    const generated = generateJwtKeyPair();
    process.env.JWT_PRIVATE_KEY = Buffer.from(generated.privateKey).toString('base64');
    process.env.JWT_PUBLIC_KEY = Buffer.from(generated.publicKey).toString('base64');
    const loaded = loadKeyPairFromEnv();
    expect(loaded.privateKey).toContain('-----BEGIN');
    expect(loaded.publicKey).toContain('-----BEGIN');
  });

  it('throws when env vars are missing', () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    expect(() => loadKeyPairFromEnv()).toThrow(/JWT keys not found/);
  });
});

describe('loadOrGenerateKeyPair', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jwt-keys-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('generates and writes a new pair when nothing exists', () => {
    const priv = join(dir, 'priv.pem');
    const pub = join(dir, 'pub.pem');
    const pair = loadOrGenerateKeyPair(priv, pub);
    expect(pair.privateKey).toContain('-----BEGIN');
    expect(pair.publicKey).toContain('-----BEGIN');
  });

  it('loads an existing pair from disk on second call', () => {
    const priv = join(dir, 'priv.pem');
    const pub = join(dir, 'pub.pem');
    const first = loadOrGenerateKeyPair(priv, pub);
    const second = loadOrGenerateKeyPair(priv, pub);
    expect(first.privateKey).toBe(second.privateKey);
  });

  it('throws when only one half of the pair exists', () => {
    const priv = join(dir, 'priv.pem');
    writeFileSync(priv, 'partial');
    expect(() =>
      loadOrGenerateKeyPair(priv, join(dir, 'missing-pub.pem')),
    ).toThrow(/Incomplete key pair/);
  });
});

describe('getJwtKeyPair', () => {
  afterEach(() => restoreEnv());

  it('prefers env vars when both are set', () => {
    const generated = generateJwtKeyPair();
    process.env.JWT_PRIVATE_KEY = generated.privateKey;
    process.env.JWT_PUBLIC_KEY = generated.publicKey;
    const pair = getJwtKeyPair();
    expect(pair.privateKey).toBe(generated.privateKey);
  });

  it('falls back to filesystem when env is unset and paths are given', () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    const dir = mkdtempSync(join(tmpdir(), 'jwt-keys-'));
    const priv = join(dir, 'priv.pem');
    const pub = join(dir, 'pub.pem');
    try {
      const pair = getJwtKeyPair({
        privateKeyPath: priv,
        publicKeyPath: pub,
        generateIfMissing: true,
      });
      expect(pair.privateKey).toContain('-----BEGIN');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when no keys are available and generation is not allowed', () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    expect(() => getJwtKeyPair()).toThrow(/JWT keys not found/);
  });
});

describe('validateKeyPair', () => {
  it('accepts a well-formed pair', () => {
    expect(validateKeyPair(generateJwtKeyPair())).toBe(true);
  });

  it('rejects non-PEM input', () => {
    expect(() =>
      validateKeyPair({ privateKey: 'nope', publicKey: 'nope' }),
    ).toThrow(/PEM format/);
  });

  it('rejects suspiciously short keys', () => {
    expect(() =>
      validateKeyPair({
        privateKey: '-----BEGIN PRIVATE KEY-----short',
        publicKey: '-----BEGIN PUBLIC KEY-----short',
      }),
    ).toThrow(/too short/);
  });
});
