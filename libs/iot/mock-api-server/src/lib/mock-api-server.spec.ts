import { mockApiServer } from './mock-api-server';

describe('mockApiServer', () => {
  it('should work', () => {
    expect(mockApiServer()).toEqual('mock-api-server');
  });
});
