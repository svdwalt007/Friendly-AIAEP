import { describe, it, expect } from 'vitest';
import { prismaSchema } from './prisma-schema';

describe('prismaSchema', () => {
  it('should return module name', () => {
    expect(prismaSchema()).toEqual('prisma-schema');
  });
});
