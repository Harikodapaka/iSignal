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
  k: 'k',
  // energy
  kcal: 'kcal', cal: 'kcal', cals: 'kcal', calorie: 'kcal', calories: 'kcal',
  // other
  mg: 'mg', mcg: 'mcg',
  steps: 'steps',
  x: 'x', times: 'x', reps: 'reps', sets: 'sets',
  percent: '%', '%': '%',
}

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
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
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
  // misc
  'seems', 'seemed', 'actually', 'basically', 'honestly', 'literally',
  'probably', 'maybe', 'perhaps', 'sure', 'yes', 'no', 'not',
])

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
])