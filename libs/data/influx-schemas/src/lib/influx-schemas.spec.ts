import { influxSchemas } from './influx-schemas';

describe('influxSchemas', () => {
  it('should work', () => {
    expect(influxSchemas()).toEqual('influx-schemas');
  });
});
