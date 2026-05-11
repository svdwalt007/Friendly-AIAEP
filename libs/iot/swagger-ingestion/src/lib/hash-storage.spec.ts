import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpecHashStorage } from './hash-storage';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('SpecHashStorage', () => {
  let storage: SpecHashStorage;
  const mockReadFile = readFile as ReturnType<typeof vi.fn>;
  const mockWriteFile = writeFile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new SpecHashStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadHashes', () => {
    it('should load hashes from file successfully', async () => {
      const mockHashes = {
        'api-1': 'hash123',
        'api-2': 'hash456',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));

      const result = await storage.loadHashes();

      expect(result).toEqual(mockHashes);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('.spec-hashes.json'),
        'utf-8'
      );
    });

    it('should return empty object if file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      const result = await storage.loadHashes();

      expect(result).toEqual({});
    });

    it('should throw error for other file read failures', async () => {
      const error = new Error('Permission denied');
      mockReadFile.mockRejectedValue(error);

      await expect(storage.loadHashes()).rejects.toThrow(
        'Failed to load spec hashes: Permission denied'
      );
    });

    it('should parse JSON correctly', async () => {
      const mockHashes = {
        'complex-api': 'abc123def456',
        'simple-api': '789xyz',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));

      const result = await storage.loadHashes();

      expect(result).toEqual(mockHashes);
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('saveHashes', () => {
    it('should save hashes to file successfully', async () => {
      const hashes = {
        'api-1': 'hash123',
        'api-2': 'hash456',
      };
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveHashes(hashes);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.spec-hashes.json'),
        JSON.stringify(hashes, null, 2),
        'utf-8'
      );
    });

    it('should format JSON with 2-space indentation', async () => {
      const hashes = {
        'api-1': 'hash123',
      };
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveHashes(hashes);

      const expectedContent = JSON.stringify(hashes, null, 2);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        expectedContent,
        'utf-8'
      );
    });

    it('should throw error on write failure', async () => {
      const error = new Error('Disk full');
      mockWriteFile.mockRejectedValue(error);

      await expect(storage.saveHashes({})).rejects.toThrow(
        'Failed to save spec hashes: Disk full'
      );
    });

    it('should handle empty hashes object', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveHashes({});

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({}, null, 2),
        'utf-8'
      );
    });
  });

  describe('hasChanged', () => {
    it('should return true if hash has changed', async () => {
      const mockHashes = {
        'api-1': 'oldHash123',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));

      const result = await storage.hasChanged('api-1', 'newHash456');

      expect(result).toBe(true);
    });

    it('should return false if hash has not changed', async () => {
      const mockHashes = {
        'api-1': 'hash123',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));

      const result = await storage.hasChanged('api-1', 'hash123');

      expect(result).toBe(false);
    });

    it('should return true if API ID does not exist in stored hashes', async () => {
      const mockHashes = {
        'api-1': 'hash123',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));

      const result = await storage.hasChanged('api-2', 'newHash');

      expect(result).toBe(true);
    });

    it('should return true if no hashes file exists', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      const result = await storage.hasChanged('api-1', 'hash123');

      expect(result).toBe(true);
    });

    it('should throw error on read failure', async () => {
      const error = new Error('Permission denied');
      mockReadFile.mockRejectedValue(error);

      await expect(storage.hasChanged('api-1', 'hash123')).rejects.toThrow(
        'Failed to check if spec changed for api-1: Failed to load spec hashes: Permission denied'
      );
    });
  });

  describe('updateHash', () => {
    it('should update existing hash successfully', async () => {
      const mockHashes = {
        'api-1': 'oldHash123',
        'api-2': 'hash456',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));
      mockWriteFile.mockResolvedValue(undefined);

      await storage.updateHash('api-1', 'newHash789');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.spec-hashes.json'),
        JSON.stringify(
          {
            'api-1': 'newHash789',
            'api-2': 'hash456',
          },
          null,
          2
        ),
        'utf-8'
      );
    });

    it('should add new hash if API ID does not exist', async () => {
      const mockHashes = {
        'api-1': 'hash123',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(mockHashes));
      mockWriteFile.mockResolvedValue(undefined);

      await storage.updateHash('api-2', 'newHash456');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.spec-hashes.json'),
        JSON.stringify(
          {
            'api-1': 'hash123',
            'api-2': 'newHash456',
          },
          null,
          2
        ),
        'utf-8'
      );
    });

    it('should create new hash file if it does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.updateHash('api-1', 'hash123');

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.spec-hashes.json'),
        JSON.stringify(
          {
            'api-1': 'hash123',
          },
          null,
          2
        ),
        'utf-8'
      );
    });

    it('should throw error on update failure', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      const error = new Error('Disk full');
      mockWriteFile.mockRejectedValue(error);

      await expect(storage.updateHash('api-1', 'hash123')).rejects.toThrow(
        'Failed to update hash for api-1: Failed to save spec hashes: Disk full'
      );
    });
  });
});
