import { describe, it, expect } from 'vitest';
import { findMetric } from '../parser';

describe('findMetric — exact key match', () => {
  const knownKeys = [
    'sleep',
    'workout',
    'protein',
    'mood',
    'water',
    'steps',
    'weight',
    'meditation',
    'reading',
    'caffeine',
    'calories',
    'run',
    'energy',
    'stress',
    'screen',
    'alcohol',
  ];
  for (const key of knownKeys) {
    it(`finds "${key}" by exact key`, () => {
      expect(findMetric(key)?.key).toBe(key);
    });
  }
});

describe('findMetric — common aliases', () => {
  const aliasTests: [string, string][] = [
    ['slept', 'sleep'],
    ['nap', 'sleep'],
    ['napped', 'sleep'],
    ['gym', 'workout'],
    ['exercise', 'workout'],
    ['trained', 'workout'],
    ['lift', 'workout'],
    ['cardio', 'workout'],
    ['hiit', 'workout'],
    ['leg day', 'workout'],
    ['chest day', 'workout'],
    ['whey', 'protein'],
    ['protein shake', 'protein'],
    ['vibe', 'mood'],
    ['happy', 'mood'],
    ['sad', 'mood'],
    ['meh', 'mood'],
    ['hydration', 'water'],
    ['h2o', 'water'],
    ['walked', 'steps'],
    ['walk', 'steps'],
    ['pedometer', 'steps'],
    ['bodyweight', 'weight'],
    ['scale', 'weight'],
    ['bw', 'weight'],
    ['meditated', 'meditation'],
    ['mindfulness', 'meditation'],
    ['breathwork', 'meditation'],
    ['book', 'reading'],
    ['studied', 'reading'],
    ['coffee', 'caffeine'],
    ['espresso', 'caffeine'],
    ['tea', 'caffeine'],
    ['latte', 'caffeine'],
    ['matcha', 'caffeine'],
    ['cold brew', 'caffeine'],
    ['intake', 'calories'],
    ['nutrition', 'calories'],
    ['diet', 'calories'],
    ['running', 'run'],
    ['jogged', 'run'],
    ['treadmill', 'run'],
    ['5k', 'run'],
    ['tired', 'energy'],
    ['fatigue', 'energy'],
    ['exhausted', 'energy'],
    ['anxiety', 'stress'],
    ['anxious', 'stress'],
    ['overwhelmed', 'stress'],
    ['screen time', 'screen'],
    ['phone', 'screen'],
    ['scrolling', 'screen'],
    ['netflix', 'screen'],
    ['youtube', 'screen'],
    ['tiktok', 'screen'],
    ['beer', 'alcohol'],
    ['wine', 'alcohol'],
    ['whiskey', 'alcohol'],
    ['vodka', 'alcohol'],
    ['cocktail', 'alcohol'],
  ];
  for (const [alias, expectedKey] of aliasTests) {
    it(`"${alias}" → ${expectedKey}`, () => {
      expect(findMetric(alias)?.key).toBe(expectedKey);
    });
  }
});

describe('findMetric — typo tolerance', () => {
  it('catches single-char typos in metric keys', () => {
    expect(findMetric('slep')?.key).toBe('sleep');
    expect(findMetric('sleeo')?.key).toBe('sleep');
    expect(findMetric('moof')?.key).toBe('mood');
  });

  it('catches single-char typos in aliases', () => {
    expect(findMetric('gyn')?.key).toBe('workout');
    expect(findMetric('coffe')?.key).toBe('caffeine');
    expect(findMetric('exrcise')?.key).toBe('workout');
  });

  it('does NOT match distance > 1', () => {
    expect(findMetric('protien')).toBeUndefined();
    expect(findMetric('wieght')).toBeUndefined();
    expect(findMetric('sloop')).toBeUndefined();
    expect(findMetric('exrciss')).toBeUndefined();
  });

  it('does NOT fuzzy match noise words', () => {
    expect(findMetric('shit')).toBeUndefined();
    expect(findMetric('dump')).toBeUndefined();
    expect(findMetric('poop')).toBeUndefined();
  });

  it('does NOT fuzzy match short tokens (< 3 chars)', () => {
    expect(findMetric('ru')).toBeUndefined();
    expect(findMetric('mo')).toBeUndefined();
  });
});
