/**
 * ENCRYPTION UTILITIES - USAGE EXAMPLES
 *
 * This file demonstrates how to use the AES-256-GCM encryption utilities
 * provided by the auth-adapter library.
 *
 * DO NOT RUN THIS FILE - It's for reference only!
 */

import {
  encrypt,
  decrypt,
  encryptCredential,
  decryptCredential,
  generateEncryptionKey,
  isEncryptedFormat,
  deriveKey,
  type Credential,
} from './src/index';

// ============================================================================
// EXAMPLE 1: Basic Encryption/Decryption
// ============================================================================

function example1_basicEncryption() {
  // Set your encryption key in environment
  process.env.ENCRYPTION_KEY = 'your-secure-master-key-here';

  // Encrypt sensitive data
  const plaintext = 'This is my secret data';
  const ciphertext = encrypt(plaintext);

  console.log('Encrypted:', ciphertext);
  // Output: "iv:authTag:encrypted" (base64-encoded components)

  // Decrypt the data
  const decrypted = decrypt(ciphertext);

  console.log('Decrypted:', decrypted); // "This is my secret data"
}

// ============================================================================
// EXAMPLE 2: Using Custom Encryption Keys
// ============================================================================

function example2_customKey() {
  const customKey = 'my-custom-encryption-key';

  // Encrypt with custom key
  const ciphertext = encrypt('sensitive data', customKey);

  // Decrypt with the same key
  const plaintext = decrypt(ciphertext, customKey);

  console.log(plaintext); // "sensitive data"
}

// ============================================================================
// EXAMPLE 3: Encrypting Credentials
// ============================================================================

async function example3_credentialEncryption() {
  // Original credential with sensitive fields
  const credential: Credential = {
    username: 'api-user@example.com',
    password: 'P@ssw0rd!123',
    apiKey: 'sk_live_1234567890abcdef',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  };

  // Encrypt sensitive fields (password, apiKey, token)
  const encrypted = encryptCredential(credential);

  console.log('Encrypted credential:', encrypted);
  // {
  //   username: 'api-user@example.com',  // Not encrypted (not sensitive)
  //   password: 'iv:authTag:encrypted',  // Encrypted
  //   apiKey: 'iv:authTag:encrypted',    // Encrypted
  //   token: 'iv:authTag:encrypted'      // Encrypted
  // }

  // Store encrypted credential in database
  await database.storeCredential(encrypted);

  // Later, retrieve and decrypt
  const stored = await database.getCredential();
  const decrypted = decryptCredential(stored);

  console.log('Decrypted credential:', decrypted);
  // Original credential restored
}

// ============================================================================
// EXAMPLE 4: Storing Encrypted Configuration
// ============================================================================

function example4_encryptedConfig() {
  const config = {
    appName: 'My Application',
    apiUrl: 'https://api.example.com',

    // Encrypt sensitive config values
    apiSecret: encrypt('super-secret-api-key'),
    databasePassword: encrypt('db-password-123'),
    webhookSigningKey: encrypt('whsec_abcdef123456'),
  };

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));

  // Load and use
  const loadedConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));

  const apiSecret = decrypt(loadedConfig.apiSecret);
  const dbPassword = decrypt(loadedConfig.databasePassword);

  console.log('Decrypted API Secret:', apiSecret);
}

// ============================================================================
// EXAMPLE 5: Multi-Tenant Encryption with Custom Salts
// ============================================================================

function example5_multiTenantEncryption() {
  const tenantId = 'tenant-123';
  const sensitiveData = 'tenant-specific-data';

  // Encrypt with tenant-specific salt
  const options = { salt: `tenant-${tenantId}` };
  const encrypted = encrypt(sensitiveData, undefined, options);

  // Decrypt with same tenant-specific salt
  const decrypted = decrypt(encrypted, undefined, options);

  console.log(decrypted); // "tenant-specific-data"
}

// ============================================================================
// EXAMPLE 6: Generating New Encryption Keys
// ============================================================================

function example6_generateKey() {
  // Generate a new 256-bit encryption key
  const newKey = generateEncryptionKey();

  console.log('New encryption key:', newKey);
  // Output: "a1b2c3d4e5f6..." (64 hex characters = 32 bytes)

  // Use the generated key
  process.env.ENCRYPTION_KEY = newKey;

  const encrypted = encrypt('data');
  const decrypted = decrypt(encrypted);
}

// ============================================================================
// EXAMPLE 7: Key Rotation Strategy
// ============================================================================

async function example7_keyRotation() {
  const oldKey = process.env.OLD_ENCRYPTION_KEY!;
  const newKey = process.env.NEW_ENCRYPTION_KEY!;

  // Get all encrypted credentials from database
  const allCredentials = await database.getAllCredentials();

  for (const encryptedCred of allCredentials) {
    // Decrypt with old key
    const decrypted = decryptCredential(encryptedCred, oldKey);

    // Re-encrypt with new key
    const reencrypted = encryptCredential(decrypted, newKey);

    // Update in database
    await database.updateCredential(encryptedCred.id, reencrypted);
  }

  console.log('Key rotation complete!');
}

// ============================================================================
// EXAMPLE 8: Validating Encrypted Format
// ============================================================================

function example8_validateFormat() {
  const value = 'some-value-from-database';

  if (isEncryptedFormat(value)) {
    // Value is encrypted, decrypt it
    const decrypted = decrypt(value);
    console.log('Decrypted:', decrypted);
  } else {
    // Value is not encrypted, use as-is
    console.log('Plain value:', value);
  }
}

// ============================================================================
// EXAMPLE 9: Error Handling
// ============================================================================

function example9_errorHandling() {
  try {
    const ciphertext = encrypt('data', 'key1');

    // Trying to decrypt with wrong key
    const plaintext = decrypt(ciphertext, 'wrong-key');
  } catch (error) {
    if (error instanceof DecryptionError) {
      console.error('Decryption failed:', error.message);
      console.error('Cause:', error.cause);
    }
  }
}

// ============================================================================
// EXAMPLE 10: REST API Integration
// ============================================================================

class ApiCredentialService {
  async storeApiCredential(userId: string, credential: Credential) {
    // Encrypt before storing
    const encrypted = encryptCredential(credential);

    await database.insert('api_credentials', {
      user_id: userId,
      username: encrypted.username,
      password: encrypted.password,
      api_key: encrypted.apiKey,
      created_at: new Date(),
    });
  }

  async getApiCredential(userId: string): Promise<Credential> {
    const row = await database.query(
      'SELECT * FROM api_credentials WHERE user_id = ?',
      [userId]
    );

    // Decrypt when retrieving
    const encrypted = {
      username: row.username,
      password: row.password,
      apiKey: row.api_key,
    };

    return decryptCredential(encrypted);
  }

  async updatePassword(userId: string, newPassword: string) {
    // Encrypt new password
    const encrypted = encrypt(newPassword);

    await database.update('api_credentials',
      { password: encrypted },
      { user_id: userId }
    );
  }
}

// ============================================================================
// EXAMPLE 11: Using with Environment Variables
// ============================================================================

function example11_envVariables() {
  // Set encryption key from environment
  // In production, load from .env file:
  // ENCRYPTION_KEY=your-generated-key-here

  require('dotenv').config();

  // No need to pass key explicitly
  const encrypted = encrypt('sensitive data');
  const decrypted = decrypt(encrypted);

  console.log(decrypted); // "sensitive data"
}

// ============================================================================
// EXAMPLE 12: Key Derivation
// ============================================================================

function example12_keyDerivation() {
  const masterKey = 'my-master-password';

  // Derive a cryptographic key from master password
  const derivedKey1 = deriveKey(masterKey, 'salt1');
  const derivedKey2 = deriveKey(masterKey, 'salt2');

  console.log('Keys are different:', !derivedKey1.equals(derivedKey2));

  // Use same salt for consistency
  const derivedKey3 = deriveKey(masterKey, 'salt1');
  console.log('Keys are same:', derivedKey1.equals(derivedKey3));
}

// ============================================================================
// EXAMPLE 13: Database Schema Integration
// ============================================================================

const databaseSchema = `
  CREATE TABLE user_credentials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    username VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,  -- Encrypted with encrypt()
    api_key TEXT,            -- Encrypted with encrypt()
    token TEXT,              -- Encrypted with encrypt()
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

// ============================================================================
// EXAMPLE 14: Express.js Middleware
// ============================================================================

function example14_expressMiddleware() {
  const express = require('express');
  const app = express();

  // Middleware to decrypt encrypted credentials from headers
  app.use((req, res, next) => {
    const encryptedApiKey = req.headers['x-encrypted-api-key'];

    if (encryptedApiKey && typeof encryptedApiKey === 'string') {
      try {
        req.apiKey = decrypt(encryptedApiKey);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
    }

    next();
  });

  app.get('/api/data', (req, res) => {
    // Use decrypted API key
    if (!req.apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    res.json({ data: 'secret data' });
  });
}

// ============================================================================
// EXAMPLE 15: Prisma Integration
// ============================================================================

async function example15_prismaIntegration() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  // Create user with encrypted credentials
  const user = await prisma.user.create({
    data: {
      email: 'user@example.com',
      credentials: {
        create: {
          username: 'api-user',
          password: encrypt('password123'),
          apiKey: encrypt('sk_live_abc123'),
        },
      },
    },
    include: {
      credentials: true,
    },
  });

  // Retrieve and decrypt
  const retrieved = await prisma.credentials.findUnique({
    where: { userId: user.id },
  });

  if (retrieved) {
    const decryptedPassword = decrypt(retrieved.password);
    const decryptedApiKey = decrypt(retrieved.apiKey);

    console.log('Decrypted credentials:', {
      username: retrieved.username,
      password: decryptedPassword,
      apiKey: decryptedApiKey,
    });
  }
}

// ============================================================================
// Mock database for examples
// ============================================================================

const database = {
  async storeCredential(credential: any) {
    console.log('Storing credential:', credential);
  },
  async getCredential() {
    return {
      username: 'api-user',
      password: 'encrypted-password',
      apiKey: 'encrypted-api-key',
    };
  },
  async getAllCredentials() {
    return [];
  },
  async updateCredential(id: string, credential: any) {
    console.log('Updating credential:', id, credential);
  },
  async insert(table: string, data: any) {
    console.log('Inserting into', table, data);
  },
  async query(sql: string, params: any[]) {
    return {
      username: 'api-user',
      password: 'encrypted',
      api_key: 'encrypted',
    };
  },
  async update(table: string, data: any, where: any) {
    console.log('Updating', table, data, where);
  },
};

// Mock DecryptionError for example
class DecryptionError extends Error {}

export {
  example1_basicEncryption,
  example2_customKey,
  example3_credentialEncryption,
  example4_encryptedConfig,
  example5_multiTenantEncryption,
  example6_generateKey,
  example7_keyRotation,
  example8_validateFormat,
  example9_errorHandling,
  example11_envVariables,
  example12_keyDerivation,
};
