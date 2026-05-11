import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type ApiId = string;

/**
 * Manages storage and retrieval of OpenAPI spec hashes to detect changes
 */
export class SpecHashStorage {
  private readonly hashFilePath: string;

  constructor() {
    // Store .spec-hashes.json in the swagger-ingestion library directory
    this.hashFilePath = join(__dirname, '..', '..', '.spec-hashes.json');
  }

  /**
   * Load stored hashes from .spec-hashes.json
   * @returns Record of API IDs to their stored hash values
   */
  async loadHashes(): Promise<Record<ApiId, string>> {
    try {
      const content = await readFile(this.hashFilePath, 'utf-8');
      return JSON.parse(content) as Record<ApiId, string>;
    } catch (error) {
      // Return empty object if file doesn't exist or can't be read
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new Error(
        `Failed to load spec hashes: ${(error as Error).message}`
      );
    }
  }

  /**
   * Save hashes to .spec-hashes.json
   * @param hashes Record of API IDs to hash values to save
   */
  async saveHashes(hashes: Record<ApiId, string>): Promise<void> {
    try {
      const content = JSON.stringify(hashes, null, 2);
      await writeFile(this.hashFilePath, content, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to save spec hashes: ${(error as Error).message}`
      );
    }
  }

  /**
   * Check if the spec hash has changed for a given API
   * @param apiId The API identifier
   * @param newHash The new hash to compare
   * @returns true if the hash has changed or doesn't exist, false otherwise
   */
  async hasChanged(apiId: ApiId, newHash: string): Promise<boolean> {
    try {
      const storedHashes = await this.loadHashes();
      const storedHash = storedHashes[apiId];

      // If no stored hash exists, consider it changed
      if (!storedHash) {
        return true;
      }

      // Compare new hash with stored hash
      return storedHash !== newHash;
    } catch (error) {
      throw new Error(
        `Failed to check if spec changed for ${apiId}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update the hash for a specific API
   * @param apiId The API identifier
   * @param newHash The new hash value
   */
  async updateHash(apiId: ApiId, newHash: string): Promise<void> {
    try {
      const hashes = await this.loadHashes();
      hashes[apiId] = newHash;
      await this.saveHashes(hashes);
    } catch (error) {
      throw new Error(
        `Failed to update hash for ${apiId}: ${(error as Error).message}`
      );
    }
  }
}
