import { describe, it, expect } from 'vitest';
import { parseLogInput, parseLogInputMulti } from '../parser';

describe('calories metric key conflict (#1)', () => {
  it('"calories 2000" resolves to calories metric', () => {
    const result = parseLogInput('calories 2000');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ metricKey: 'calories', value: 2000 });
  });

  it('"2000 calories" also works', () => {
    const result = parseLogInput('2000 calories');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ metricKey: 'calories', value: 2000 });
  });
});

describe('"and a half" handling (#4)', () => {
  it('"sleep 7 and a half hours" → 7.5h', () => {
    expect(parseLogInput('sleep 7 and a half hours')).toMatchObject({ metricKey: 'sleep', value: 7.5, unit: 'h' });
  });

  it('"meditation 1 and a half hours" → 90min', () => {
    expect(parseLogInput('meditation 1 and a half hours')).toMatchObject({
      metricKey: 'meditation',
      value: 90,
      unit: 'min',
    });
  });

  it('multi-metric preserves "and a half"', () => {
    const results = parseLogInputMulti('sleep 7 and a half hours, workout');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'sleep', value: 7.5, unit: 'h' });
    expect(results[1]).toMatchObject({ metricKey: 'workout', value: true });
  });
});

describe('context-aware blocking — "back hurts" (#12)', () => {
  it('"my back hurts" does NOT resolve to workout', () => {
    expect(parseLogInput('my back hurts')?.metricKey).not.toBe('workout');
  });

  it('"back pain" does NOT resolve to workout', () => {
    expect(parseLogInput('back pain')?.metricKey).not.toBe('workout');
  });

  it('"back day" still resolves to workout', () => {
    expect(parseLogInput('back day')).toMatchObject({ metricKey: 'workout', value: true });
  });
});

describe('energy drink override (#13)', () => {
  it('"energy drink" → caffeine', () => {
    expect(parseLogInput('energy drink')).toMatchObject({ metricKey: 'caffeine' });
  });

  it('"had an energy drink" → caffeine', () => {
    expect(parseLogInput('had an energy drink')).toMatchObject({ metricKey: 'caffeine' });
  });

  it('"energy 7" still resolves to energy metric', () => {
    expect(parseLogInput('energy 7')).toMatchObject({ metricKey: 'energy', value: 7, unit: '/10' });
  });
});
