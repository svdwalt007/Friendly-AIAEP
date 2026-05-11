# Spec Hash Storage

Utility for managing OpenAPI specification hashes to detect changes between ingestion runs.

## Overview

The `SpecHashStorage` class provides a simple file-based storage mechanism for tracking OpenAPI spec hashes. This allows the system to detect when a spec has changed and avoid unnecessary re-ingestion of unchanged specs.

## Features

- **Persistent Storage**: Stores hashes in `.spec-hashes.json` file
- **Change Detection**: Compares new hashes against stored values
- **Async Operations**: All methods use async file I/O
- **Error Handling**: Graceful handling of missing files and I/O errors
- **Type Safety**: Full TypeScript support

## Usage

### Basic Example

```typescript
import { SpecHashStorage } from '@friendly-aiaep/swagger-ingestion';

const storage = new SpecHashStorage();

// Check if a spec has changed
const hasChanged = await storage.hasChanged('my-api-v1', 'new-hash-value');

if (hasChanged) {
  // Process the spec
  console.log('Spec has changed, processing...');

  // Update the stored hash after processing
  await storage.updateHash('my-api-v1', 'new-hash-value');
}
```

### Loading All Hashes

```typescript
const storage = new SpecHashStorage();

// Load all stored hashes
const hashes = await storage.loadHashes();
console.log(hashes);
// Output: { 'api-1': 'hash123', 'api-2': 'hash456' }
```

### Saving Hashes

```typescript
const storage = new SpecHashStorage();

const hashes = {
  'api-1': 'abc123',
  'api-2': 'def456',
  'api-3': 'ghi789',
};

await storage.saveHashes(hashes);
```

### Checking for Changes

```typescript
const storage = new SpecHashStorage();

// Returns true if hash is different or doesn't exist
const changed = await storage.hasChanged('my-api', 'new-hash');

if (changed) {
  console.log('API spec has been updated!');
}
```

### Updating a Single Hash

```typescript
const storage = new SpecHashStorage();

// Update hash for a specific API
await storage.updateHash('my-api', 'updated-hash-value');
```

## API Reference

### `loadHashes(): Promise<Record<ApiId, string>>`

Loads all stored hashes from the `.spec-hashes.json` file.

**Returns:** A record mapping API IDs to their hash values

**Behavior:**
- Returns an empty object if the file doesn't exist
- Throws an error for other I/O failures

### `saveHashes(hashes: Record<ApiId, string>): Promise<void>`

Saves the provided hashes to the `.spec-hashes.json` file.

**Parameters:**
- `hashes`: Record of API IDs to hash values

**Behavior:**
- Creates the file if it doesn't exist
- Overwrites existing content
- Formats JSON with 2-space indentation

### `hasChanged(apiId: ApiId, newHash: string): Promise<boolean>`

Checks if a spec hash has changed for a given API.

**Parameters:**
- `apiId`: The API identifier
- `newHash`: The new hash to compare

**Returns:** `true` if the hash has changed or doesn't exist, `false` otherwise

### `updateHash(apiId: ApiId, newHash: string): Promise<void>`

Updates the hash for a specific API.

**Parameters:**
- `apiId`: The API identifier
- `newHash`: The new hash value

**Behavior:**
- Loads current hashes
- Updates the hash for the specified API
- Saves the updated hashes back to the file

## Storage Location

Hashes are stored in `.spec-hashes.json` in the `libs/iot/swagger-ingestion/` directory.

This file is automatically excluded from version control via `.gitignore`.

## Error Handling

All methods include proper error handling:

- **File Not Found**: Returns empty object or considers spec as "changed"
- **Read Errors**: Throws descriptive error with context
- **Write Errors**: Throws descriptive error with context

Example error handling:

```typescript
try {
  await storage.updateHash('api-1', 'new-hash');
} catch (error) {
  console.error('Failed to update hash:', error.message);
}
```

## Integration Example

Here's how to integrate hash storage with spec ingestion:

```typescript
import { SpecHashStorage } from '@friendly-aiaep/swagger-ingestion';
import { createHash } from 'crypto';

async function ingestSpec(apiId: string, specContent: string) {
  const storage = new SpecHashStorage();

  // Calculate hash of the spec content
  const hash = createHash('sha256').update(specContent).digest('hex');

  // Check if spec has changed
  const hasChanged = await storage.hasChanged(apiId, hash);

  if (!hasChanged) {
    console.log(`Spec for ${apiId} unchanged, skipping ingestion`);
    return;
  }

  // Process the spec
  await processSpec(apiId, specContent);

  // Update the stored hash
  await storage.updateHash(apiId, hash);
  console.log(`Successfully ingested ${apiId}`);
}
```

## Testing

The module includes comprehensive unit tests covering:

- Loading hashes from file
- Saving hashes to file
- Change detection logic
- Error handling scenarios
- Edge cases (missing files, empty objects, etc.)

Run tests with:

```bash
pnpm nx test swagger-ingestion
```

## File Format

The `.spec-hashes.json` file uses a simple JSON structure:

```json
{
  "api-1": "abc123def456...",
  "api-2": "789xyz...",
  "my-custom-api": "hash-value-here"
}
```

Each key is an API identifier, and each value is the corresponding hash string.
