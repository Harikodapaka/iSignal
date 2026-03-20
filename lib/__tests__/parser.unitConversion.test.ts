import { describe, it, expect } from 'vitest';
import { parseLogInput } from '../parser';

describe('unit conversion — time', () => {
  it('converts min → h for sleep', () => {
    expect(parseLogInput('sleep 90min')).toMatchObject({ metricKey: 'sleep', value: 1.5, unit: 'h' });
  });

  it('converts 60min → 1h for sleep', () => {
    expect(parseLogInput('sleep 60 minutes')).toMatchObject({ metricKey: 'sleep', value: 1, unit: 'h' });
  });

  it('converts h → min for meditation', () => {
    expect(parseLogInput('meditation 1h')).toMatchObject({ metricKey: 'meditation', value: 60, unit: 'min' });
  });

  it('converts h → min for reading', () => {
    expect(parseLogInput('reading 2h')).toMatchObject({ metricKey: 'reading', value: 120, unit: 'min' });
  });

  it('converts sec → h for sleep', () => {
    expect(parseLogInput('sleep 3600 sec')).toMatchObject({ metricKey: 'sleep', value: 1, unit: 'h' });
  });
});

describe('unit conversion — distance', () => {
  it('converts mi → km for run', () => {
    const result = parseLogInput('run 2mi');
    expect(result).toMatchObject({ metricKey: 'run', unit: 'km' });
    expect(result!.value).toBeCloseTo(3.22, 1);
  });

  it('converts m → km for run', () => {
    expect(parseLogInput('run 5000m')).toMatchObject({ metricKey: 'run', value: 5, unit: 'km' });
  });
});

describe('unit conversion — volume', () => {
  it('converts ml → L for water', () => {
    expect(parseLogInput('water 500ml')).toMatchObject({ metricKey: 'water', value: 0.5, unit: 'L' });
  });

  it('converts cups → L for water', () => {
    const result = parseLogInput('water 4 cups');
    expect(result).toMatchObject({ metricKey: 'water', unit: 'L' });
    expect(result!.value).toBeCloseTo(0.95, 1);
  });
});

describe('unit conversion — weight', () => {
  it('converts lb → kg for weight', () => {
    const result = parseLogInput('weight 150lb');
    expect(result).toMatchObject({ metricKey: 'weight', unit: 'kg' });
    expect(result!.value).toBeCloseTo(68.04, 0);
  });

  it('converts oz → kg for weight', () => {
    const result = parseLogInput('weight 160 oz');
    expect(result).toMatchObject({ metricKey: 'weight', unit: 'kg' });
    expect(result!.value).toBeCloseTo(4.54, 1);
  });
});

describe('unit conversion — edge cases', () => {
  it('no conversion when units match', () => {
    expect(parseLogInput('sleep 7h')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('no conversion for incompatible units', () => {
    expect(parseLogInput('sleep 7 kg')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'kg' });
  });
});

describe('smart unit inference', () => {
  it('infers h for sleep', () => {
    expect(parseLogInput('sleep 7')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('infers g for protein', () => {
    expect(parseLogInput('protein 50')).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
  });

  it('infers /10 for mood', () => {
    expect(parseLogInput('mood 8')).toMatchObject({ metricKey: 'mood', value: 8, unit: '/10' });
  });

  it('infers kcal for calories via alias', () => {
    expect(parseLogInput('intake 2000')).toMatchObject({ metricKey: 'calories', value: 2000, unit: 'kcal' });
  });

  it('infers min for meditation', () => {
    expect(parseLogInput('meditation 15')).toMatchObject({ metricKey: 'meditation', value: 15, unit: 'min' });
  });

  it('infers L for water', () => {
    expect(parseLogInput('water 2')).toMatchObject({ metricKey: 'water', value: 2, unit: 'L' });
  });

  it('explicit unit triggers conversion over inference', () => {
    expect(parseLogInput('sleep 90 min')).toMatchObject({ metricKey: 'sleep', value: 1.5, unit: 'h' });
  });
});

describe('serving size conversions — caffeine', () => {
  it('"2 cups coffee" → 190mg', () => {
    expect(parseLogInput('2 cups coffee')).toMatchObject({ metricKey: 'caffeine', value: 190, unit: 'mg' });
  });

  it('"1 cup tea" → 95mg', () => {
    expect(parseLogInput('1 cup tea')).toMatchObject({ metricKey: 'caffeine', value: 95, unit: 'mg' });
  });

  it('"3 shots espresso" → 189mg', () => {
    expect(parseLogInput('3 shots espresso')).toMatchObject({ metricKey: 'caffeine', value: 189, unit: 'mg' });
  });

  it('"1 shot espresso" → 63mg', () => {
    expect(parseLogInput('1 shot espresso')).toMatchObject({ metricKey: 'caffeine', value: 63, unit: 'mg' });
  });

  it('"1 can energy drink" → 80mg', () => {
    expect(parseLogInput('1 can energy drink')).toMatchObject({ metricKey: 'caffeine', value: 80, unit: 'mg' });
  });
});

describe('serving size conversions — protein', () => {
  it('"2 scoops protein" → 50g', () => {
    expect(parseLogInput('2 scoops protein')).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
  });

  it('"1 scoop whey" → 25g', () => {
    expect(parseLogInput('1 scoop whey')).toMatchObject({ metricKey: 'protein', value: 25, unit: 'g' });
  });

  it('"3 servings protein" → 75g', () => {
    expect(parseLogInput('3 servings protein')).toMatchObject({ metricKey: 'protein', value: 75, unit: 'g' });
  });

  it('explicit grams not re-converted', () => {
    expect(parseLogInput('protein 50g')).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
  });
});

describe('serving vs unit conversion — water cups', () => {
  it('"water 2 cups" → unit conversion to L (not serving)', () => {
    const result = parseLogInput('water 2 cups');
    expect(result).toMatchObject({ metricKey: 'water', unit: 'L' });
    expect(result!.value).toBeCloseTo(0.47, 1);
  });
});
