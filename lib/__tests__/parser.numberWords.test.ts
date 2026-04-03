import { describe, it, expect } from 'vitest';
import { parseLogInput, parseLogInputMulti } from '../parser';

describe('parseLogInput — number words (one, two, three...)', () => {
  // ── Basic number word recognition ──

  it('"one glass of water" → water 0.25L', () => {
    const result = parseLogInput('one glass of water');
    expect(result).toMatchObject({ metricKey: 'water', value: 0.25, unit: 'L' });
  });

  it('"two glasses of water" → water 0.5L', () => {
    const result = parseLogInput('two glasses of water');
    expect(result).toMatchObject({ metricKey: 'water', value: 0.5, unit: 'L' });
  });

  it('"three cups of coffee" → caffeine 285mg', () => {
    const result = parseLogInput('three cups of coffee');
    expect(result).toMatchObject({ metricKey: 'caffeine', value: 285, unit: 'mg' });
  });

  it('"four glasses of water" → water 1L', () => {
    const result = parseLogInput('four glasses of water');
    expect(result).toMatchObject({ metricKey: 'water', value: 1, unit: 'L' });
  });

  // ── Natural language with number words ──

  it('"I drank one glass of water" → water 0.25L', () => {
    const result = parseLogInput('I drank one glass of water');
    expect(result).toMatchObject({ metricKey: 'water', value: 0.25, unit: 'L' });
  });

  it('"had two scoops protein" → protein 50g', () => {
    const result = parseLogInput('had two scoops protein');
    expect(result).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
  });

  it('"drank one cup of coffee" → caffeine 95mg', () => {
    const result = parseLogInput('drank one cup of coffee');
    expect(result).toMatchObject({ metricKey: 'caffeine', value: 95, unit: 'mg' });
  });

  // ── All number words (one through twelve) ──

  it('"one" → 1', () => {
    const result = parseLogInput('sleep one');
    expect(result).toMatchObject({ metricKey: 'sleep', value: 1, valueType: 'number' });
  });

  it('"two" → 2', () => {
    const result = parseLogInput('water two L');
    expect(result).toMatchObject({ metricKey: 'water', value: 2, unit: 'L' });
  });

  it('"five" → 5', () => {
    const result = parseLogInput('mood five');
    expect(result).toMatchObject({ metricKey: 'mood', value: 5, unit: '/10' });
  });

  it('"seven" → 7', () => {
    const result = parseLogInput('sleep seven');
    expect(result).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('"eight" → 8', () => {
    const result = parseLogInput('mood eight');
    expect(result).toMatchObject({ metricKey: 'mood', value: 8, unit: '/10' });
  });

  it('"ten" → 10', () => {
    const result = parseLogInput('meditation ten');
    expect(result).toMatchObject({ metricKey: 'meditation', value: 10, unit: 'min' });
  });

  it('"twelve" → 12', () => {
    const result = parseLogInput('reading twelve');
    expect(result).toMatchObject({ metricKey: 'reading', value: 12, unit: 'min' });
  });

  // ── Number words should produce number type, not boolean ──

  it('number word with known numeric metric → number, not boolean', () => {
    const result = parseLogInput('I drank one glass of water');
    expect(result?.valueType).toBe('number');
    expect(result?.value).not.toBe(true);
  });

  it('number word without unit still yields number type', () => {
    const result = parseLogInput('mood six');
    expect(result).toMatchObject({ metricKey: 'mood', value: 6, valueType: 'number' });
  });

  // ── Mixed: number words + numeric digits shouldn't conflict ──

  it('numeric digits still work normally', () => {
    expect(parseLogInput('water 2L')).toMatchObject({ metricKey: 'water', value: 2, unit: 'L' });
  });

  it('digit takes precedence when both present (digit comes first)', () => {
    // Edge case: "3 glasses" — 3 is parsed first, then "glasses" is unit
    const result = parseLogInput('3 glasses of water');
    expect(result).toMatchObject({ metricKey: 'water', value: 0.75, unit: 'L' });
  });

  // ── Multi-metric with number words ──

  it('multi-metric: "one coffee and two glasses water"', () => {
    const results = parseLogInputMulti('one cup coffee and two glasses water');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'caffeine', value: 95, unit: 'mg' });
    expect(results[1]).toMatchObject({ metricKey: 'water', value: 0.5, unit: 'L' });
  });

  it('multi-metric: "five minutes meditation, mood eight"', () => {
    const results = parseLogInputMulti('five minutes meditation, mood eight');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ metricKey: 'meditation', value: 5, unit: 'min' });
    expect(results[1]).toMatchObject({ metricKey: 'mood', value: 8, unit: '/10' });
  });

  // ── Regression: "one" should NOT be treated as noise anymore ──

  it('"one" is not swallowed as noise', () => {
    const result = parseLogInput('one glass water');
    expect(result?.value).toBe(0.25);
    expect(result?.valueType).toBe('number');
  });

  it('"two" is not swallowed as noise', () => {
    const result = parseLogInput('two cups coffee');
    expect(result).toMatchObject({ metricKey: 'caffeine', value: 190, unit: 'mg' });
  });
});
