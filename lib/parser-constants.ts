// ── Unit normalisation ────────────────────────────────────────────────────────
export const UNIT_MAP: Record<string, string> = {
  // time
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  min: 'min', mins: 'min', minute: 'min', minutes: 'min',
  sec: 'sec', secs: 'sec', second: 'sec', seconds: 'sec',
  // weight / mass
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', grams: 'g', gram: 'g',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  // volume / liquid
  l: 'L', L: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  cup: 'cup', cups: 'cup',
  glass: 'glass', glasses: 'glass',
  // distance
  km: 'km', kms: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km',
  mi: 'mi', mile: 'mi', miles: 'mi',
  m: 'm', meter: 'm', meters: 'm', metre: 'm',
  k: 'km',
  // energy
  kcal: 'kcal', cal: 'kcal', cals: 'kcal', calorie: 'kcal', calories: 'kcal',
  // other
  mg: 'mg', mcg: 'mcg',
  steps: 'steps',
  x: 'x', times: 'x', reps: 'reps', sets: 'sets',
  percent: '%', '%': '%',
  // servings (converted to real units via SERVING_CONVERSIONS)
  scoop: 'scoop', scoops: 'scoop',
  serving: 'serving', servings: 'serving',
  shot: 'shot', shots: 'shot',
  can: 'can', cans: 'can',
};

// ── Noise words ───────────────────────────────────────────────────────────────
// Stripped before metric key matching — carry no metric signal.
export const NOISE_WORDS = new Set([
  // articles
  'a', 'an', 'the',
  // pronouns
  'i', 'my', 'me', 'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their',
  // conjunctions
  'and', 'or', 'but', 'so', 'yet', 'nor',
  // prepositions
  'at', 'in', 'on', 'to', 'of', 'by', 'for', 'up', 'as',
  'with', 'from', 'into', 'onto', 'upon', 'over', 'under', 'about',
  'around', 'after', 'before', 'during', 'through', 'without', 'within',
  'between', 'among', 'along', 'across', 'behind', 'below', 'above',
  'near', 'off', 'out', 'per', 'since', 'than', 'until', 'via',
  // filler verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did',
  'have', 'has', 'had',
  'get', 'got', 'gotten',
  'go', 'went', 'gone',
  'put', 'place', 'take', 'took', 'make', 'made', 'keep', 'kept',
  'try', 'tried', 'need', 'want', 'let', 'like',
  'doing', 'going', 'coming',
  // qualifiers & adverbs
  'very', 'really', 'quite', 'just', 'only', 'too', 'so',
  'super', 'pretty', 'kinda', 'sorta', 'barely', 'almost', 'nearly',
  'slightly', 'totally', 'absolutely', 'extremely', 'incredibly',
  // descriptors — never identify a metric on their own
  'good', 'bad', 'okay', 'ok', 'fine', 'well', 'nice',
  'amazing', 'awesome', 'terrible', 'horrible', 'decent', 'solid',
  'intense', 'hard', 'easy', 'quick', 'slow', 'fast', 'long', 'short',
  'heavy', 'light', 'big', 'small', 'high', 'low', 'full', 'empty',
  // completion words
  'done', 'finished', 'finish', 'completed', 'complete',
  'started', 'start', 'beginning', 'ended', 'end',
  // quantity words
  'some', 'any', 'all', 'few', 'many', 'much', 'more', 'less',
  'bit', 'little', 'lot', 'lots', 'enough', 'half', 'whole',
  'couple', 'several', 'multiple', 'bunch',
  // time words
  'today', 'tonight', 'yesterday', 'tomorrow',
  'now', 'later', 'soon', 'already', 'still', 'again',
  'this', 'last', 'next', 'past', 'current',
  'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon',
  'early', 'late', 'daily', 'weekly', 'monthly',
  // filler nouns — wrap activities but are not metrics themselves
  'session', 'sessions', 'practice', 'routine', 'time', 'times',
  'thing', 'stuff', 'count', 'level', 'levels', 'amount', 'total',
  'number', 'value', 'effort', 'day', 'days', 'week', 'weeks',
  // 'feeling' is always filler — the word AFTER it is the real signal
  // e.g. 'feeling anxious' → anxious=stress, 'feeling exhausted' → exhausted=energy
  'feel', 'felt', 'feeling', 'feelings', 'feels',
  // grooming / personal care — no metric signal on their own
  'showered', 'brushed', 'flossed', 'washed', 'groomed', 'trimmed',
  // expletives / vague bodily terms — no standalone metric signal
  'shit', 'dump', 'poop', 'crap', 'pee', 'piss',
  // misc
  'seems', 'seemed', 'actually', 'basically', 'honestly', 'literally',
  'probably', 'maybe', 'perhaps', 'sure', 'yes', 'no', 'not',
]);

// ── Verb tokens ───────────────────────────────────────────────────────────────
// Past-tense action verbs — get a -0.5 score penalty when matching metrics.
// Prevents "drank coffee" → alcohol by ensuring the noun ("coffee") outscores
// the verb ("drank"). Verbs that are also metric aliases still resolve correctly
// at score 1.5 (alias 2 - penalty 0.5) vs a non-matching token at 0.
export const VERB_TOKENS = new Set([
  // ingestion
  'drank', 'ate', 'eaten', 'consumed', 'had', 'took', 'swallowed',
  'sipped', 'gulped', 'chewed', 'tasted', 'cooked', 'made', 'ordered', 'bought',
  // movement / exercise
  'ran', 'walked', 'jogged', 'cycled', 'biked', 'swam', 'hiked', 'climbed',
  'lifted', 'exercised', 'trained', 'stretched', 'sprinted', 'rowed', 'skated',
  'skied', 'snowboarded', 'surfed', 'played', 'performed', 'danced', 'workedout',
  // sleep / rest
  'slept', 'napped', 'rested', 'dozed', 'crashed', 'woke', 'awoke',
  // mental / cognitive
  'felt', 'thought', 'noticed', 'realized', 'decided', 'focused', 'concentrated',
  'meditated', 'breathed', 'reflected', 'reviewed', 'journaled', 'planned',
  'visualized', 'affirmed',
  // productivity / work
  'worked', 'coded', 'built', 'created', 'wrote', 'designed', 'shipped',
  'deployed', 'fixed', 'debugged', 'presented', 'met', 'called',
  'messaged', 'emailed', 'zoomed', 'organized', 'cleaned',
  // learning
  'read', 'studied', 'learned', 'practiced', 'watched', 'listened',
  'attended', 'completed', 'finished', 'started', 'stopped',
  // life / social
  'drove', 'commuted', 'traveled', 'flew', 'arrived', 'left', 'visited',
  'talked', 'chatted', 'hung', 'celebrated', 'helped',
  // tracking meta-verbs (weakest signal)
  'logged', 'tracked', 'recorded', 'noted', 'checked', 'measured', 'weighed',
  'did', 'went', 'done', 'tried', 'fasted', 'sang',
  // grooming
  'shaved', 'shaving',
]);

// ── Unit conversions ─────────────────────────────────────────────────────────
// Converts between compatible units when user logs in a different unit than the metric expects.
// e.g. metric expects "h" but user logs "60min" → converts to 1h
export const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // time
  min: { h: 1 / 60, sec: 60 },
  h: { min: 60, sec: 3600 },
  sec: { min: 1 / 60, h: 1 / 3600 },
  // weight
  kg: { lb: 2.20462, g: 1000, oz: 35.274 },
  lb: { kg: 0.453592, g: 453.592, oz: 16 },
  g: { kg: 0.001, lb: 0.00220462, oz: 0.035274 },
  oz: { g: 28.3495, kg: 0.0283495, lb: 0.0625 },
  // volume
  L: { ml: 1000, cup: 4.22675, glass: 4 },
  ml: { L: 0.001, cup: 0.00422675, glass: 0.004 },
  cup: { L: 0.236588, ml: 236.588, glass: 1 },
  glass: { L: 0.25, ml: 250, cup: 1 },
  // distance
  km: { mi: 0.621371, m: 1000 },
  mi: { km: 1.60934, m: 1609.34 },
  m: { km: 0.001, mi: 0.000621371 },
  // energy
  kcal: {},
};

// ── Beverage/serving size → unit conversion ──────────────────────────────────
// Fix #8 & #9: Convert serving-based inputs to metric's expected unit.
// "2 cups of coffee" → caffeine 190mg (1 cup ≈ 95mg)
// "2 scoops protein" → protein 50g (1 scoop ≈ 25g)
export const SERVING_CONVERSIONS: Record<string, Record<string, { factor: number; unit: string }>> = {
  caffeine: {
    cup: { factor: 95, unit: 'mg' }, // 1 cup coffee ≈ 95mg caffeine
    glass: { factor: 95, unit: 'mg' },
    shot: { factor: 63, unit: 'mg' }, // 1 espresso shot ≈ 63mg
    can: { factor: 80, unit: 'mg' }, // 1 energy drink can ≈ 80mg
  },
  protein: {
    scoop: { factor: 25, unit: 'g' }, // 1 scoop ≈ 25g protein
    scoops: { factor: 25, unit: 'g' },
    serving: { factor: 25, unit: 'g' },
    servings: { factor: 25, unit: 'g' },
  },
};

// ── Tokens that are BOTH a unit and a metric alias ───────────────────────────
// Fix #1: "calories 2000" — "calories" is in UNIT_MAP but is also a metric alias.
// These tokens should be treated as metric keys, NOT units, when they appear with a number.
export const METRIC_ALIAS_UNITS = new Set([
  'calories',
  'calorie',
  'cal',
  'cals',
  'kcal', // alias for calories metric AND unit
  'steps', // alias for steps metric AND unit
]);

// ── Sentiment → numeric value for /10 metrics ───────────────────────────────
export const SENTIMENT_SCORES: Record<string, number> = {
  // very positive (9-10)
  amazing: 9, awesome: 9, fantastic: 9, incredible: 9, excellent: 9, perfect: 10, ecstatic: 10, wonderful: 9, superb: 9, brilliant: 9,
  // positive (7-8)
  great: 8, good: 7, happy: 7, nice: 7, fine: 7, solid: 7, decent: 7, pleasant: 7, cheerful: 8, joyful: 8, lovely: 8, pumped: 8,
  // neutral (5-6)
  okay: 5, ok: 5, alright: 5, meh: 5, neutral: 5, average: 5, normal: 5, so: 5,
  // negative (3-4)
  bad: 3, poor: 3, rough: 3, low: 3, down: 3, sad: 3, upset: 4, off: 4, blah: 4, moody: 4, irritated: 3, anxious: 3,
  // very negative (1-2)
  terrible: 2, awful: 2, horrible: 2, miserable: 2, dreadful: 2, worst: 1, depressed: 2, wrecked: 2, crushed: 2,
};

// ── Contextual alias overrides ───────────────────────────────────────────────
// When certain words appear together, they change meaning.
// "energy drink" → caffeine, not energy. "back hurts" → not workout.
export const CONTEXT_OVERRIDES: { pattern: RegExp; metricKey: string; blockKeys?: string[] }[] = [
  // Fix #13: "energy drink" should be caffeine, not energy
  { pattern: /\benergy\s+drink\b/i, metricKey: 'caffeine', blockKeys: ['energy'] },
  // Fix #12: "back hurts/pain/ache" should NOT match workout
  {
    pattern: /\bback\s+(?:hurts?|pain|ache|sore|stiff|injury|problem)/i,
    metricKey: '__block__',
    blockKeys: ['workout'],
  },
];

// ── Number words → numeric values ───────────────────────────────────────────
// "one glass of water" → value=1, "two cups of coffee" → value=2
export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

// ── Multi-metric splitter constants ─────────────────────────────────────────
// Fix #4: Preserves "and a half" — don't split when "and" is part of a fractional value.
export const HALF_PATTERN = /\band\s+a\s+half\b/gi;
export const HALF_PLACEHOLDER = '__HALF__';
