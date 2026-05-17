import { environmentService } from './environment-service';

describe('environmentService', () => {
  it('should work', () => {
    expect(environmentService()).toEqual('environment-service');
  });
});
