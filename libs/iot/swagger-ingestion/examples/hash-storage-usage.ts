/**
 * Example usage of SpecHashStorage for OpenAPI spec change detection
 */

import { SpecHashStorage } from '../src/lib/hash-storage';
import { createHash } from 'crypto';

/**
 * Example 1: Basic usage - Check if a spec has changed
 */
async function example1() {
  const storage = new SpecHashStorage();

  // Simulate fetching an OpenAPI spec
  const specContent = JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'My API', version: '1.0.0' },
    paths: {},
  });

  // Calculate hash of the spec content
  const hash = createHash('sha256').update(specContent).digest('hex');

  // Check if spec has changed
  const hasChanged = await storage.hasChanged('my-api-v1', hash);

  if (hasChanged) {
    console.log('Spec has changed, processing...');
    // Process the spec here...

    // Update the stored hash after processing
    await storage.updateHash('my-api-v1', hash);
  } else {
    console.log('Spec unchanged, skipping processing');
  }
}

/**
 * Example 2: Managing multiple API specs
 */
async function example2() {
  const storage = new SpecHashStorage();

  const apis = [
    { id: 'users-api', content: '{"openapi":"3.0.0","paths":{}}' },
    { id: 'orders-api', content: '{"openapi":"3.0.0","paths":{}}' },
    { id: 'products-api', content: '{"openapi":"3.0.0","paths":{}}' },
  ];

  for (const api of apis) {
    const hash = createHash('sha256').update(api.content).digest('hex');

    const changed = await storage.hasChanged(api.id, hash);

    if (changed) {
      console.log(`Processing ${api.id}...`);
      // Process the API spec
      await storage.updateHash(api.id, hash);
    } else {
      console.log(`Skipping ${api.id} (no changes)`);
    }
  }
}

/**
 * Example 3: Bulk operations with all hashes
 */
async function example3() {
  const storage = new SpecHashStorage();

  // Load all current hashes
  const allHashes = await storage.loadHashes();
  console.log('Currently tracked APIs:', Object.keys(allHashes));

  // Create a new hash collection
  const newHashes: Record<string, string> = {
    'api-1': 'hash123abc',
    'api-2': 'hash456def',
    'api-3': 'hash789ghi',
  };

  // Save all hashes at once
  await storage.saveHashes(newHashes);
  console.log('Updated all hashes');
}

/**
 * Example 4: Error handling
 */
async function example4() {
  const storage = new SpecHashStorage();

  try {
    const changed = await storage.hasChanged('my-api', 'new-hash');
    console.log('Has changed:', changed);
  } catch (error) {
    console.error('Error checking hash:', error);
  }

  try {
    await storage.updateHash('my-api', 'new-hash-value');
    console.log('Hash updated successfully');
  } catch (error) {
    console.error('Error updating hash:', error);
  }
}

/**
 * Example 5: Integration with spec ingestion pipeline
 */
async function ingestSpecWithHashCheck(
  apiId: string,
  specUrl: string
): Promise<void> {
  const storage = new SpecHashStorage();

  // Fetch the spec
  const response = await fetch(specUrl);
  const specContent = await response.text();

  // Calculate hash
  const hash = createHash('sha256').update(specContent).digest('hex');

  // Check if changed
  const hasChanged = await storage.hasChanged(apiId, hash);

  if (!hasChanged) {
    console.log(`Spec for ${apiId} is unchanged, skipping ingestion`);
    return;
  }

  console.log(`Processing spec for ${apiId}...`);

  try {
    // Parse and process the spec
    const spec = JSON.parse(specContent);
    // ... process the spec ...

    // Update hash after successful processing
    await storage.updateHash(apiId, hash);
    console.log(`Successfully ingested ${apiId}`);
  } catch (error) {
    console.error(`Failed to ingest ${apiId}:`, error);
    // Don't update hash if ingestion failed
  }
}

// Run examples (uncomment to execute)
// example1().catch(console.error);
// example2().catch(console.error);
// example3().catch(console.error);
// example4().catch(console.error);
// ingestSpecWithHashCheck('my-api', 'https://api.example.com/openapi.json').catch(console.error);
