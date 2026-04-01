import { describe, it, expect } from 'vitest';
import { parseLogInputMulti } from '../parser';

describe('parseLogInputMulti — splitting', () => {
  it('splits on "and"', () => {
    const results = parseLogInputMulti('ran 5k and drank 2L water');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'run', value: 5, unit: 'km' });
    expect(results[1]).toMatchObject({ metricKey: 'water', value: 2, unit: 'L' });
  });

  it('splits on commas', () => {
    const results = parseLogInputMulti('sleep 7h, workout, mood 8');
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
    expect(results[1]).toMatchObject({ metricKey: 'workout', value: true, valueType: 'boolean' });
    expect(results[2]).toMatchObject({ metricKey: 'mood', value: 8, unit: '/10' });
  });

  it('splits on "then"', () => {
    const results = parseLogInputMulti('meditation 15min then reading 30min');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'meditation', value: 15, unit: 'min' });
    expect(results[1]).toMatchObject({ metricKey: 'reading', value: 30, unit: 'min' });
  });

  it('splits on "also"', () => {
    const results = parseLogInputMulti('protein 50g also water 2L');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
    expect(results[1]).toMatchObject({ metricKey: 'water', value: 2, unit: 'L' });
  });

  it('splits on semicolons', () => {
    const results = parseLogInputMulti('sleep 8h; workout; protein 50g');
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ metricKey: 'sleep', value: 8, unit: 'h' });
    expect(results[1]).toMatchObject({ metricKey: 'workout', value: true });
    expect(results[2]).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
  });

  it('splits on "plus"', () => {
    const results = parseLogInputMulti('water 2L plus protein 50g');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'water', value: 2 });
    expect(results[1]).toMatchObject({ metricKey: 'protein', value: 50 });
  });
});

describe('parseLogInputMulti — edge cases', () => {
  it('single metric → array of one', () => {
    const results = parseLogInputMulti('sleep 7h');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('empty input → empty array', () => {
    expect(parseLogInputMulti('')).toEqual([]);
  });

  it('whitespace-only → empty array', () => {
    expect(parseLogInputMulti('   ')).toEqual([]);
  });

  it('skips unparseable segments', () => {
    const results = parseLogInputMulti('sleep 7h and the, workout');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]).toMatchObject({ metricKey: 'sleep', value: 7 });
  });

  it('skips all-noise segments', () => {
    const results = parseLogInputMulti('sleep 7h, the, workout');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'sleep' });
    expect(results[1]).toMatchObject({ metricKey: 'workout' });
  });

  it('handles mixed value types', () => {
    const results = parseLogInputMulti('sleep 7h, mood 8, workout');
    expect(results).toHaveLength(3);
    expect(results[0].valueType).toBe('number');
    expect(results[1].valueType).toBe('number');
    expect(results[2].valueType).toBe('boolean');
  });
});
