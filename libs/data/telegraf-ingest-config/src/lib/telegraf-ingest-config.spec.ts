import { telegrafIngestConfig } from './telegraf-ingest-config';

describe('telegrafIngestConfig', () => {
  it('should work', () => {
    expect(telegrafIngestConfig()).toEqual('telegraf-ingest-config');
  });
});
