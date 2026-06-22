/**
 * Normalizes ingredient names + units so the shopping list is one row per
 * logical item for the whole plan, with amounts summed in a sensible unit:
 * grams (dry goods, butter), ml (liquids), egg count, bread slices, etc.
 */

function stripPrepWords(name) {
  return (name || '')
    .toLowerCase()
    .replace(
      /\b(fresh|dried|chopped|minced|sliced|grated|ground|whole|small|large|medium|canned|diced|crushed|puree|ripe|baby|extra|virgin|light|unsalted|salted|melted|softened)\b/g,
      ' '
    )
    .replace(/\b(cold\s*-?\s*pressed)\b/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeLastWord(phrase) {
  const words = phrase.split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const last = words[words.length - 1];
  if (last.length < 4) return words.join(' ');
  let w = last;
  if (w.endsWith('oes') && w.length > 4) {
    w = w.slice(0, -3) + 'o';
  } else if (w.endsWith('ies')) {
    w = w.slice(0, -3) + 'y';
  } else if (w.endsWith('s') && !w.endsWith('ss')) {
    w = w.slice(0, -1);
  }
  words[words.length - 1] = w;
  return words.join(' ');
}

/** "3 cloves garlic" / "2 tbsp oil" → drop leading amount + measure word. */
function stripLeadingQuantityFromName(rawName) {
  return (rawName || '')
    .trim()
    .replace(
      /^\d+[\d./\s-]*\s*(clove|cloves|tbsp|tbs|tsp|cup|cups|g|kg|ml|l|oz|lb|slice|slices|sprig|sprigs|bunch|bunches|can|cans|head|heads|bulb|bulbs)?\s+/i,
      ''
    )
    .trim();
}

/** "garlic cloves" / "onion chopped" → drop trailing count/prep unit words in the name. */
function stripTrailingCountUnits(phrase) {
  return (phrase || '')
    .replace(
      /\s+(clove|cloves|sprig|sprigs|stalk|stalks|slice|slices|head|heads|bulb|bulbs|bunch|bunches|leaf|leaves)$/i,
      ''
    )
    .trim();
}

function normalizeIngredientBaseName(rawName) {
  const withoutQty = stripLeadingQuantityFromName(rawName);
  const stripped = stripPrepWords(withoutQty);
  const singular = singularizeLastWord(stripped);
  return stripTrailingCountUnits(singular);
}

/** Convert raw unit string to a canonical token (lowercase). */
function aliasUnit(rawUnit) {
  let t = (rawUnit || '')
    .toLowerCase()
    .trim()
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ');

  const map = {
    '': 'each',
    '-': 'each',
    g: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    ml: 'ml',
    milliliter: 'ml',
    milliliters: 'ml',
    millilitre: 'ml',
    millilitres: 'ml',
    mls: 'ml',
    l: 'l',
    liter: 'l',
    liters: 'l',
    litre: 'l',
    litres: 'l',
    tbsp: 'tbsp',
    tbs: 'tbsp',
    tbsps: 'tbsp',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tblsp: 'tbsp',
    tblsps: 'tbsp',
    tsp: 'tsp',
    tsps: 'tsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    cup: 'cup',
    cups: 'cup',
    'fl oz': 'floz',
    floz: 'floz',
    'fluid ounce': 'floz',
    'fluid ounces': 'floz',
    oz: 'oz',
    ounce: 'oz',
    ounces: 'oz',
    lb: 'lb',
    lbs: 'lb',
    pound: 'lb',
    pounds: 'lb',
    pinch: 'pinch',
    pinches: 'pinch',
    clove: 'clove',
    cloves: 'clove',
    sprig: 'sprig',
    sprigs: 'sprig',
    slice: 'slice',
    slices: 'slice',
    bunch: 'bunch',
    bunches: 'bunch',
    stick: 'stick',
    sticks: 'stick',
    can: 'can',
    cans: 'can',
    package: 'package',
    packages: 'package',
    pkt: 'package',
    stalk: 'stalk',
    stalks: 'stalk',
    leaf: 'leaf',
    leaves: 'leaf',
    cube: 'cube',
    cubes: 'cube',
    buc: 'each',
    bucăți: 'each',
    bucati: 'each',
    pcs: 'each',
    pc: 'each',
    piece: 'each',
    pieces: 'each',
    knob: 'knob',
    knobs: 'knob',
    pat: 'pat',
    pats: 'pat',
    dozen: 'dozen',
    dozens: 'dozen',
    loaf: 'loaf',
    loaves: 'loaf',
  };

  if (map[t] !== undefined) return map[t];
  return t || 'each';
}

const VOL_TO_ML = {
  ml: 1,
  l: 1000,
  tbsp: 15,
  tsp: 5,
  cup: 240,
  floz: 29.5735,
};

const MASS_TO_G = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const BUTTER_G_PER_ML = 0.911;
const BUTTER_GRAMS_PER_CUP_SOLID = 227;

function isProseQuantityUnit(rawUnit) {
  const raw = String(rawUnit || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  return (
    !raw ||
    /^(to taste|to serve|for serving|for greasing|greasing|a little|optional|n\/a|dash|splash)$/.test(
      raw
    )
  );
}

/** Remove chop/dice/slice words from recipe units so we only measure, not prep text. */
function stripPrepSuffixFromUnit(rawUnit) {
  let s = String(rawUnit || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  s = s
    .replace(
      /\b(finely\s+|roughly\s+|coarsely\s+)?(chopped|minced|diced|crushed|sliced|grated|quartered|halved)\b/g,
      ''
    )
    .trim();
  return s;
}

/** US cup–style dry goods: mass + cup/tbsp/tsp + volume as if scooped (g per full cup). */
function dryGoodsToGrams(qty, rawUnit, gramsPerCup) {
  if (!qty) return 0;
  if (isProseQuantityUnit(rawUnit)) return 0;
  const cleaned = stripPrepSuffixFromUnit(rawUnit);
  const u = aliasUnit(cleaned || rawUnit);

  if (MASS_TO_G[u] !== undefined) return qty * MASS_TO_G[u];
  if (u === 'cup') return qty * gramsPerCup;
  if (u === 'tbsp') return qty * (gramsPerCup / 16);
  if (u === 'tsp') return qty * (gramsPerCup / 48);
  if (VOL_TO_ML[u] !== undefined) {
    return qty * VOL_TO_ML[u] * (gramsPerCup / 240);
  }
  return 0;
}

/**
 * Produce / veg: cup (chopped/diced), count (each), slice, mass, or ml via cup density.
 * gramsPerItem = medium whole unit (e.g. one onion, one potato).
 */
function produceToGrams(qty, rawUnit, gramsPerCup, gramsPerItem) {
  if (!qty) return 0;
  if (isProseQuantityUnit(rawUnit)) return 0;
  const cleaned = stripPrepSuffixFromUnit(rawUnit);
  const u = aliasUnit(cleaned || rawUnit);

  if (MASS_TO_G[u] !== undefined) return qty * MASS_TO_G[u];
  if (u === 'cup') return qty * gramsPerCup;
  if (u === 'tbsp') return qty * (gramsPerCup / 16);
  if (u === 'tsp') return qty * (gramsPerCup / 48);
  if (u === 'slice') {
    const per = gramsPerItem
      ? Math.max(8, gramsPerItem / 10)
      : gramsPerCup / 12;
    return qty * per;
  }
  if (u === 'pinch') return qty * 2;
  if (u === 'each' && gramsPerItem) {
    return qty * gramsPerItem;
  }
  if (VOL_TO_ML[u] !== undefined && gramsPerCup) {
    return qty * VOL_TO_ML[u] * (gramsPerCup / 240);
  }
  if (gramsPerItem) return qty * gramsPerItem;
  return 0;
}

function butterGramMergeKey(b) {
  if (!/\bbutter\b/.test(b)) return null;
  if (
    /\bpeanut\b|\bapple\b|\bcacao\b|\bcocoa\b|\bcookie\b|\balmond\b|\bcashew\b|\bhazelnut\b|\bpecan\b/.test(
      b
    )
  ) {
    return null;
  }
  return 'butter';
}

function butterQuantityToGrams(qty, rawUnit) {
  if (!qty) return 0;
  const raw = String(rawUnit || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  if (isProseQuantityUnit(rawUnit)) return 0;

  if (/\bknob(s)?\b/.test(raw)) return qty * 15;
  if (/\bpat(s)?\b/.test(raw)) return qty * 7;

  const u = aliasUnit(rawUnit);

  if (u === 'stick' || /\bstick(s)?\b/.test(raw)) return qty * 113.5;
  if (u === 'slice' || /\bslice(s)?\b/.test(raw)) return qty * 7;
  if (u === 'knob') return qty * 15;
  if (u === 'pat') return qty * 7;

  if (MASS_TO_G[u] !== undefined) return qty * MASS_TO_G[u];

  if (u === 'cup' || raw === 'cup' || raw === 'cups') return qty * BUTTER_GRAMS_PER_CUP_SOLID;

  if (VOL_TO_ML[u] !== undefined) {
    const ml = qty * VOL_TO_ML[u];
    return ml * BUTTER_G_PER_ML;
  }

  if (u === 'each') return qty * 12;

  return 0;
}

function flourGramMergeKey(b) {
  if (!/\bflour\b/.test(b)) return null;
  if (/\bcoconut\b|\balmond\b|\bchickpea\b|\bcornmeal\b/.test(b)) return null;
  return 'flour';
}

function sugarGramMergeKey(b) {
  if (!/\bsugar\b/.test(b)) return null;
  return 'sugar';
}

function sugarGramsPerCup(baseName) {
  const b = baseName;
  if (/\bbrown\b|\bmuscovado\b|\bdemerara\b/.test(b)) return 220;
  if (/\bicing\b|\bpowdered\b|\bconfectioners\b|\bcastor\b|\bcaster\b/.test(b)) return 125;
  return 200;
}

function riceGramMergeKey(b) {
  if (!/\brice\b/.test(b)) return null;
  if (/\bwine\b|\bvinegar\b|\bpaper\b|\bnoodle\b|\bmilk\b|\bflour\b/.test(b)) {
    return null;
  }
  return 'rice';
}

function oatsGramMergeKey(b) {
  if (/\boatmeal cookie\b/.test(b)) return null;
  if (/\boat(s)?\b/.test(b)) return 'oats';
  if (/\bporridge oat\b/.test(b)) return 'oats';
  return null;
}

function saltGramMergeKey(b) {
  if (!/\bsalt\b/.test(b)) return null;
  if (/\bsalt cod\b/.test(b)) return null;
  return 'salt';
}

function pastaGramMergeKey(b) {
  if (
    /\bpasta\b|\bspaghetti\b|\bpenne\b|\bfusilli\b|\bmacaroni\b|\blinguine\b|\bfettuccine\b|\brigatoni\b/.test(
      b
    )
  ) {
    return 'pasta';
  }
  return null;
}

const GRAMS_PER_CUP = {
  flour: 125,
  rice: 185,
  oats: 90,
  salt: 288,
  pasta: 115,
  /** Chopped / diced in cup (240 ml). */
  onion: 160,
  potato: 150,
  /** Diced / chopped tomato in cup. */
  tomato: 180,
  /** Sweet bell / capsicum, chopped. */
  bellPepper: 150,
  /** Ground black / fine spice; cup is loose pack. */
  pepperSpice: 110,
};

const GRAMS_PER_ITEM = {
  onion: 110,
  potato: 150,
  tomato: 120,
  bellPepper: 120,
};

function onionGramMergeKey(b) {
  if (!/\bonion(s)?\b/.test(b)) return null;
  if (/\bgreen onion\b|\bspring onion\b|\bscallion\b|\bshallot\b/.test(b)) return null;
  return 'onion';
}

function potatoGramMergeKey(b) {
  if (!/\bpotato(es)?\b/.test(b)) return null;
  return 'potato';
}

function tomatoGramMergeKey(b) {
  if (!/\btomato(es)?\b/.test(b)) return null;
  if (/\btomato puree\b|\btomato paste\b|\btomato sauce\b|\bsun dried tomato\b/.test(b)) {
    return null;
  }
  return 'tomato';
}

/** Sweet peppers (capsicum), not chilli or spice “pepper”. */
function bellPepperGramMergeKey(b) {
  if (/\bbell pepper\b|\bsweet pepper\b|\bcapsicum\b/.test(b)) return 'bell pepper';
  if (/\b(red|green|yellow|orange) bell pepper\b/.test(b)) return 'bell pepper';
  if (/\b(red|yellow|green|orange) pepper\b/.test(b)) return 'bell pepper';
  return null;
}

/** Ground / powder “pepper” and heat spices → one merged total in grams. */
/** Strip prep words from the *unit* string so "tablespoon chopped" → tbsp. */
function normalizeHerbMeasureUnit(rawUnit) {
  let s = stripPrepSuffixFromUnit(rawUnit);
  s = s.replace(/\b(leaf|leaves)\b/g, '').trim();
  return s;
}

/**
 * Soft leafy herbs: one merged line in grams (cup/tbsp/tsp/ml/sprig/bunch/each).
 * Approximate loosely packed chopped cup weights.
 */
function freshSoftHerbSpec(base) {
  const b = base;
  if (/\bdried\b/.test(b)) return null;
  if (/\bparsley\b/.test(b)) {
    return {
      id: 'parsley',
      cup: 60,
      sprig: 3,
      bunch: 28,
      each: 4,
      display: 'Parsley',
    };
  }
  if (
    /\bcilantro\b/.test(b) ||
    (/\bcoriander\b/.test(b) && /\b(leaf|leaves|fresh)\b/.test(b))
  ) {
    return {
      id: 'cilantro',
      cup: 40,
      sprig: 3,
      bunch: 35,
      each: 3,
      display: 'Cilantro',
    };
  }
  if (/\bbasil\b/.test(b)) {
    return {
      id: 'basil',
      cup: 24,
      sprig: 2,
      bunch: 20,
      each: 2,
      display: 'Basil',
    };
  }
  if (/\bdill\b/.test(b)) {
    return {
      id: 'dill',
      cup: 20,
      sprig: 2,
      bunch: 25,
      each: 2,
      display: 'Dill',
    };
  }
  if (/\bmint\b/.test(b) && !/\bmint sauce\b|\bpeppermint\b/.test(b)) {
    return {
      id: 'mint',
      cup: 17,
      sprig: 2,
      bunch: 18,
      each: 2,
      display: 'Mint',
    };
  }
  return null;
}

function softHerbToGrams(qty, rawUnit, spec) {
  if (!qty) return 0;
  const rawStr = String(rawUnit || '');
  const cleaned = normalizeHerbMeasureUnit(rawUnit);

  if (!cleaned) {
    if (/\bchopped\b|\bminced\b/i.test(rawStr)) {
      return qty * (spec.cup / 32);
    }
    return qty * spec.each;
  }

  if (isProseQuantityUnit(cleaned)) return 0;

  const u = aliasUnit(cleaned);

  if (MASS_TO_G[u] !== undefined) return qty * MASS_TO_G[u];
  if (u === 'cup') return qty * spec.cup;
  if (u === 'tbsp') return qty * (spec.cup / 16);
  if (u === 'tsp') return qty * (spec.cup / 48);
  if (u === 'sprig') return qty * spec.sprig;
  if (u === 'bunch') return qty * spec.bunch;
  if (u === 'pinch') return qty * 1;
  if (VOL_TO_ML[u] !== undefined) {
    return qty * VOL_TO_ML[u] * (spec.cup / 240);
  }
  if (u === 'each') return qty * spec.each;
  return qty * spec.each;
}

function waterVolMergeKey(b) {
  if (!/\bwater\b/.test(b)) return null;
  if (/\bcoconut water\b|\brose water\b/.test(b)) return null;
  return 'water';
}

/** Plain water: always merge to one line; amounts in ml (1 g ≈ 1 ml). */
function waterQuantityToMl(qty, rawUnit) {
  if (!qty) return 0;
  if (isProseQuantityUnit(rawUnit)) return 0;
  const u = aliasUnit(rawUnit);
  if (VOL_TO_ML[u] !== undefined) return qty * VOL_TO_ML[u];
  if (MASS_TO_G[u] !== undefined) return qty * MASS_TO_G[u];
  return 0;
}

function pepperSpiceGramMergeKey(b) {
  if (/\bbell pepper\b|\bsweet pepper\b|\bcapsicum\b|\bpepperoni\b/.test(b)) return null;
  if (/\b(red|green|yellow|orange) pepper\b/.test(b)) return null;
  if (
    /\bjalapeno\b|\bhabanero\b|\bserrano\b|\bscotch bonnet\b|\bghost pepper\b/.test(
      b
    )
  ) {
    return null;
  }
  if (
    /\bcayenne\b|\bchili powder\b|\bchilli powder\b|\bchile powder\b|\bpaprika\b|\bblack pepper\b|\bwhite pepper\b|\bpeppercorn\b|\bpink peppercorn\b|\bpepper flakes\b|\bchili flakes\b|\bred pepper flakes\b/.test(
      b
    )
  ) {
    return 'pepper_spice';
  }
  if (b === 'pepper' || b === 'ground pepper') return 'pepper_spice';
  return null;
}

function eggMergeKey(b) {
  if (/\beggplant\b|\begg plant\b/.test(b)) return null;
  if (/\begg(s)?\b/.test(b)) return 'egg';
  return null;
}

/** Whole eggs (or fraction from weight). */
function eggCountDelta(qty, rawUnit) {
  if (!qty) return 0;
  if (isProseQuantityUnit(rawUnit)) return 0;
  const u = aliasUnit(rawUnit);
  if (u === 'dozen') return qty * 12;
  if (MASS_TO_G[u] !== undefined) return (qty * MASS_TO_G[u]) / 50;
  if (VOL_TO_ML[u] !== undefined) return 0;
  return qty;
}

function breadSliceMergeKey(b) {
  if (/\bbreadcrumb/.test(b)) return null;
  if (/\bbread\b/.test(b)) return 'bread';
  return null;
}

const GRAMS_PER_BREAD_SLICE = 38;

function breadSliceDelta(qty, rawUnit) {
  if (!qty) return 0;
  if (isProseQuantityUnit(rawUnit)) return 0;
  const raw = String(rawUnit || '').toLowerCase();
  const u = aliasUnit(rawUnit);
  if (u === 'slice') return qty;
  if (u === 'loaf' || /\bloaf/.test(raw)) return qty * 22;
  if (MASS_TO_G[u] !== undefined) return (qty * MASS_TO_G[u]) / GRAMS_PER_BREAD_SLICE;
  if (u === 'each') return qty;
  if (VOL_TO_ML[u] !== undefined) return 0;
  return qty;
}

const GRAMS_PER_GARLIC_CLOVE = 3;
const ML_PER_GARLIC_CLOVE = 5;

function garlicCloveMergeKey(b) {
  if (!/\bgarlic\b/.test(b)) return null;
  if (
    /\bgarlic powder\b|\bgarlic salt\b|\bgarlic bread\b|\bgarlic butter\b|\bgarlic sauce\b|\bgarlic paste\b/.test(
      b
    )
  ) {
    return null;
  }
  return 'garlic';
}

/** Fresh garlic: merge cloves, heads, minced volume, and weight into one clove count. */
function garlicToCloves(qty, rawUnit) {
  if (!qty) return 0;
  if (isProseQuantityUnit(rawUnit)) return 0;
  const raw = String(rawUnit || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  const cleaned = stripPrepSuffixFromUnit(rawUnit);
  const u = aliasUnit(cleaned || rawUnit);

  if (u === 'clove') return qty;
  if (u === 'head' || /\bhead(s)?\b/.test(raw)) return qty * 10;
  if (u === 'each') return qty;
  if (u === 'tbsp') return qty * 3;
  if (u === 'tsp') return qty * 1;
  if (MASS_TO_G[u] !== undefined) return (qty * MASS_TO_G[u]) / GRAMS_PER_GARLIC_CLOVE;
  if (VOL_TO_ML[u] !== undefined) return (qty * VOL_TO_ML[u]) / ML_PER_GARLIC_CLOVE;
  return qty;
}

/**
 * @returns {{ key: string, delta: number, kind: string, displayUnit: string, canonicalDisplayName?: string }}
 */
function shoppingMergeContribution(rawName, rawQuantity, rawUnit) {
  const base = normalizeIngredientBaseName(rawName);
  const qty = Number(rawQuantity) || 0;

  const eggKey = eggMergeKey(base);
  if (eggKey) {
    return {
      key: `${eggKey}::COUNT`,
      delta: eggCountDelta(qty, rawUnit),
      kind: 'egg',
      displayUnit: 'egg',
      canonicalDisplayName: 'Eggs',
    };
  }

  const breadKey = breadSliceMergeKey(base);
  if (breadKey) {
    return {
      key: `${breadKey}::SLICE`,
      delta: breadSliceDelta(qty, rawUnit),
      kind: 'slice',
      displayUnit: 'slice',
      canonicalDisplayName: 'Bread',
    };
  }

  const garlicKey = garlicCloveMergeKey(base);
  if (garlicKey) {
    return {
      key: `${garlicKey}::CLOVE`,
      delta: garlicToCloves(qty, rawUnit),
      kind: 'garlic',
      displayUnit: 'clove',
      canonicalDisplayName: 'Garlic',
    };
  }

  const butterKey = butterGramMergeKey(base);
  if (butterKey) {
    const grams = butterQuantityToGrams(qty, rawUnit);
    return {
      key: `${butterKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Butter',
    };
  }

  const flourKey = flourGramMergeKey(base);
  if (flourKey) {
    const grams = dryGoodsToGrams(qty, rawUnit, GRAMS_PER_CUP.flour);
    return {
      key: `${flourKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Flour',
    };
  }

  const sugarKey = sugarGramMergeKey(base);
  if (sugarKey) {
    const gpc = sugarGramsPerCup(base);
    let mergeId = 'sugar';
    let display = 'Sugar';
    if (gpc === 220) {
      mergeId = 'brown sugar';
      display = 'Brown sugar';
    } else if (gpc === 125) {
      mergeId = 'icing sugar';
      display = 'Icing sugar';
    }
    const grams = dryGoodsToGrams(qty, rawUnit, gpc);
    return {
      key: `${mergeId}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: display,
    };
  }

  const riceKey = riceGramMergeKey(base);
  if (riceKey) {
    const grams = dryGoodsToGrams(qty, rawUnit, GRAMS_PER_CUP.rice);
    return {
      key: `${riceKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Rice',
    };
  }

  const oatsKey = oatsGramMergeKey(base);
  if (oatsKey) {
    const grams = dryGoodsToGrams(qty, rawUnit, GRAMS_PER_CUP.oats);
    return {
      key: `${oatsKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Oats',
    };
  }

  const saltKey = saltGramMergeKey(base);
  if (saltKey) {
    const grams = dryGoodsToGrams(qty, rawUnit, GRAMS_PER_CUP.salt);
    return {
      key: `${saltKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Salt',
    };
  }

  const pastaKey = pastaGramMergeKey(base);
  if (pastaKey) {
    const grams = dryGoodsToGrams(qty, rawUnit, GRAMS_PER_CUP.pasta);
    return {
      key: `${pastaKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Pasta',
    };
  }

  const onionKey = onionGramMergeKey(base);
  if (onionKey) {
    const grams = produceToGrams(
      qty,
      rawUnit,
      GRAMS_PER_CUP.onion,
      GRAMS_PER_ITEM.onion
    );
    return {
      key: `${onionKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Onions',
    };
  }

  const potatoKey = potatoGramMergeKey(base);
  if (potatoKey) {
    const grams = produceToGrams(
      qty,
      rawUnit,
      GRAMS_PER_CUP.potato,
      GRAMS_PER_ITEM.potato
    );
    return {
      key: `${potatoKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Potatoes',
    };
  }

  const tomatoKey = tomatoGramMergeKey(base);
  if (tomatoKey) {
    const grams = produceToGrams(
      qty,
      rawUnit,
      GRAMS_PER_CUP.tomato,
      GRAMS_PER_ITEM.tomato
    );
    return {
      key: `${tomatoKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Tomatoes',
    };
  }

  const bellKey = bellPepperGramMergeKey(base);
  if (bellKey) {
    const grams = produceToGrams(
      qty,
      rawUnit,
      GRAMS_PER_CUP.bellPepper,
      GRAMS_PER_ITEM.bellPepper
    );
    return {
      key: `${bellKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Bell peppers',
    };
  }

  const spicePepperKey = pepperSpiceGramMergeKey(base);
  if (spicePepperKey) {
    const grams = dryGoodsToGrams(qty, rawUnit, GRAMS_PER_CUP.pepperSpice);
    return {
      key: `${spicePepperKey}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: 'Pepper',
    };
  }

  const herbSpec = freshSoftHerbSpec(base);
  if (herbSpec) {
    const grams = softHerbToGrams(qty, rawUnit, herbSpec);
    return {
      key: `${herbSpec.id}::GRAMS`,
      delta: grams,
      kind: 'mass',
      displayUnit: 'g',
      canonicalDisplayName: herbSpec.display,
    };
  }

  const waterKey = waterVolMergeKey(base);
  if (waterKey) {
    const ml = waterQuantityToMl(qty, rawUnit);
    return {
      key: `${waterKey}::VOL`,
      delta: ml,
      kind: 'water',
      displayUnit: 'ml',
      canonicalDisplayName: 'Water',
    };
  }

  const u = aliasUnit(rawUnit);

  if (VOL_TO_ML[u] !== undefined) {
    return {
      key: `${base}::VOL`,
      delta: qty * VOL_TO_ML[u],
      kind: 'vol',
      displayUnit: 'ml',
    };
  }

  if (MASS_TO_G[u] !== undefined) {
    return {
      key: `${base}::MASS`,
      delta: qty * MASS_TO_G[u],
      kind: 'mass',
      displayUnit: 'g',
    };
  }

  return {
    key: `${base}::${u}`,
    delta: qty,
    kind: 'other',
    displayUnit: rawUnit && String(rawUnit).trim() ? String(rawUnit).trim() : u,
  };
}

function shoppingAggregationKey(rawName, rawUnit) {
  const { key } = shoppingMergeContribution(rawName, 1, rawUnit);
  return key;
}

function titleCaseWords(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatQuantityForApi(kind, total, otherUnit) {
  const rounded = Math.round(total * 100) / 100;
  if (kind === 'water') {
    if (total >= 1000) {
      const l = Math.round((total / 1000) * 1000) / 1000;
      return { qty: l, unit: 'l' };
    }
    return { qty: rounded, unit: 'ml' };
  }
  if (kind === 'vol') return { qty: rounded, unit: 'ml' };
  if (kind === 'mass') return { qty: rounded, unit: 'g' };
  if (kind === 'egg') return { qty: rounded, unit: 'egg' };
  if (kind === 'slice') return { qty: rounded, unit: 'slice' };
  if (kind === 'garlic') return { qty: rounded, unit: 'clove' };
  const cleanedOther = stripPrepSuffixFromUnit(otherUnit || '');
  return { qty: rounded, unit: cleanedOther };
}

module.exports = {
  shoppingMergeContribution,
  shoppingAggregationKey,
  normalizeIngredientBaseName,
  aliasUnit,
  titleCaseWords,
  formatQuantityForApi,
};
