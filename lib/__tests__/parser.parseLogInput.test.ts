import { describe, it, expect } from 'vitest';
import { parseLogInput } from '../parser';

describe('parseLogInput — core behavior', () => {
  it('parses simple metric + value', () => {
    expect(parseLogInput('sleep 7h')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('parses boolean metric', () => {
    expect(parseLogInput('workout')).toMatchObject({ metricKey: 'workout', value: true, valueType: 'boolean' });
  });

  it('parses via alias', () => {
    expect(parseLogInput('gym')).toMatchObject({ metricKey: 'workout', value: true });
  });

  it('parses value-first format', () => {
    expect(parseLogInput('7h sleep')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('filters noise words', () => {
    expect(parseLogInput('did a good workout today')).toMatchObject({ metricKey: 'workout', value: true });
  });

  it('returns null for empty input', () => {
    expect(parseLogInput('')).toBeNull();
  });

  it('returns null for all noise words', () => {
    expect(parseLogInput('the a an')).toBeNull();
  });
});

describe('parseLogInput — case insensitivity', () => {
  it('handles uppercase', () => {
    expect(parseLogInput('SLEEP 7H')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('handles mixed case', () => {
    expect(parseLogInput('Workout')).toMatchObject({ metricKey: 'workout', value: true });
  });

  it('handles mixed case with value', () => {
    expect(parseLogInput('Protein 50G')).toMatchObject({ metricKey: 'protein', value: 50, unit: 'g' });
  });
});

describe('parseLogInput — decimal handling', () => {
  it('parses 7.5h sleep', () => {
    expect(parseLogInput('sleep 7.5h')).toMatchObject({ metricKey: 'sleep', value: 7.5, unit: 'h' });
  });

  it('parses 0.5L water', () => {
    expect(parseLogInput('water 0.5L')).toMatchObject({ metricKey: 'water', value: 0.5, unit: 'L' });
  });

  it('parses standalone decimal', () => {
    expect(parseLogInput('weight 68.3')).toMatchObject({ metricKey: 'weight', value: 68.3, unit: 'kg' });
  });
});

describe('parseLogInput — typo tolerance integration', () => {
  it('"slep 7h" → sleep 7h', () => {
    expect(parseLogInput('slep 7h')).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });

  it('"moof 8" → mood 8/10', () => {
    expect(parseLogInput('moof 8')).toMatchObject({ metricKey: 'mood', value: 8, unit: '/10' });
  });
});

describe('parseLogInput — user metric keys', () => {
  it('matches exact user metric key', () => {
    expect(parseLogInput('journaling 20 min', ['journaling'])).toMatchObject({
      metricKey: 'journaling',
      value: 20,
      unit: 'min',
    });
  });

  it('matches user metric key within longer input', () => {
    expect(parseLogInput('did some cold shower today', ['cold shower'])).toMatchObject({
      metricKey: 'cold shower',
      value: true,
    });
  });

  it('known metric takes priority', () => {
    expect(parseLogInput('sleep 7h', ['sleep tracker'])).toMatchObject({ metricKey: 'sleep', value: 7, unit: 'h' });
  });
});

describe('parseLogInput — noise word edge cases', () => {
  it('entirely noise words → null', () => {
    expect(parseLogInput('i am doing well today')).toBeNull();
  });

  it('single noise word → null', () => {
    expect(parseLogInput('the')).toBeNull();
  });

  it('extracts metric from heavy noise', () => {
    expect(parseLogInput('i really just did a very good intense workout session today')).toMatchObject({
      metricKey: 'workout',
      value: true,
    });
  });

  it('expletives → null', () => {
    expect(parseLogInput('shit')).toBeNull();
    expect(parseLogInput('crap')).toBeNull();
    expect(parseLogInput('poop')).toBeNull();
  });
});

describe('parseLogInput — natural language / voice inputs', () => {
  it('"slept 8 hours last night"', () => {
    expect(parseLogInput('slept 8 hours last night')).toMatchObject({ metricKey: 'sleep', value: 8, unit: 'h' });
  });

  it('"did a 30 minute meditation"', () => {
    expect(parseLogInput('did a 30 minute meditation')).toMatchObject({
      metricKey: 'meditation',
      value: 30,
      unit: 'min',
    });
  });

  it('"went to the gym today"', () => {
    expect(parseLogInput('went to the gym today')).toMatchObject({ metricKey: 'workout', value: true });
  });

  it('"feeling anxious"', () => {
    expect(parseLogInput('feeling anxious')).toMatchObject({ metricKey: 'stress' });
  });

  it('"read for 45 minutes"', () => {
    expect(parseLogInput('read for 45 minutes')).toMatchObject({ metricKey: 'reading', value: 45, unit: 'min' });
  });

  it('"drank 3 glasses of water" → 0.75L', () => {
    const result = parseLogInput('drank 3 glasses of water');
    expect(result).toMatchObject({ metricKey: 'water', value: 0.75, unit: 'L' });
  });

  it('"ran 10k this morning"', () => {
    expect(parseLogInput('ran 10k this morning')).toMatchObject({ metricKey: 'run', value: 10 });
  });

  it('"weight is 72.5 kg"', () => {
    expect(parseLogInput('weight is 72.5 kg')).toMatchObject({ metricKey: 'weight', value: 72.5, unit: 'kg' });
  });

  it('"had 2 beers tonight"', () => {
    expect(parseLogInput('had 2 beers tonight')).toMatchObject({ metricKey: 'alcohol' });
  });

  it('"mood is 6"', () => {
    expect(parseLogInput('mood is 6')).toMatchObject({ metricKey: 'mood', value: 6, unit: '/10' });
  });

  it('"walked 8000 steps"', () => {
    expect(parseLogInput('walked 8000 steps')).toMatchObject({ metricKey: 'steps', value: 8000 });
  });

  it('"3 hours of screen time"', () => {
    expect(parseLogInput('3 hours of screen time')).toMatchObject({ metricKey: 'screen', value: 3, unit: 'h' });
  });
});
