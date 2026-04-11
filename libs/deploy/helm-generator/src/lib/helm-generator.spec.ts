import { helmGenerator } from './helm-generator';

describe('helmGenerator', () => {
  it('should work', () => {
    expect(helmGenerator()).toEqual('helm-generator');
  });
});
