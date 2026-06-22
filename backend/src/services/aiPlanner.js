// Local "AI" meal planner.
// Personalizes selection per user via hard filters (diet + allergies), a
// weighted score (calorie fit, novelty, variety, time fit, fridge match) and
// weighted-random sampling from the top candidates.

// Not suitable as a standalone breakfast / lunch / dinner slot.
const EXCLUDED_CATEGORIES = ['Dessert', 'Side'];
const BREAKFAST_CATEGORIES = ['Breakfast'];
const UNHEALTHY_TAG_PATTERNS = [/fried/i, /deep.?fry/i, /bacon/i];
// Hard exclude: desserts / treats (even if miscategorized in the DB).
const TREAT_EXCLUDE_PATTERNS = [/chocolate/i, /\bcakes?\b/i];

// Dietary restriction → excluded recipe categories + ingredient patterns
const DIETARY_RULES = {
  vegetarian: {
    categories: ['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'],
    ingredientPatterns: [/chicken/i, /beef/i, /pork/i, /lamb/i, /bacon/i, /ham\b/i, /veal/i, /turkey/i, /duck/i, /sausage/i, /anchov/i, /fish/i, /shrimp/i, /prawn/i, /salmon/i, /tuna/i],
  },
  vegan: {
    categories: ['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'],
    ingredientPatterns: [
      /chicken/i, /beef/i, /pork/i, /lamb/i, /bacon/i, /ham\b/i, /veal/i, /turkey/i, /duck/i, /sausage/i, /anchov/i, /fish/i, /shrimp/i, /prawn/i, /salmon/i, /tuna/i,
      /\bmilk\b/i, /cheese/i, /butter/i, /cream/i, /yogurt/i, /egg/i, /honey/i, /gelatin/i, /whey/i, /casein/i,
    ],
  },
  glutenFree: {
    categories: ['Pasta'],
    ingredientPatterns: [/flour/i, /\bbread\b/i, /pasta/i, /wheat/i, /\brye\b/i, /barley/i, /couscous/i, /noodle/i, /spaghetti/i, /lasagn/i],
  },
  lactoseFree: {
    categories: [],
    ingredientPatterns: [/\bmilk\b/i, /cheese/i, /butter/i, /cream/i, /yogurt/i, /whey/i, /casein/i],
  },
  keto: {
    categories: ['Pasta'],
    ingredientPatterns: [/sugar/i, /pasta/i, /\brice\b/i, /potato/i, /\bbread\b/i, /flour/i],
  },
  lowCarb: {
    categories: ['Pasta'],
    ingredientPatterns: [/pasta/i, /\brice\b/i, /potato/i, /\bbread\b/i],
  },
  mediterranean: {
    categories: [],
    ingredientPatterns: [],
  },
};

// Allergy key → ingredient patterns to exclude
const ALLERGY_PATTERNS = {
  nuts: [/almond/i, /cashew/i, /hazelnut/i, /pecan/i, /pistachio/i, /walnut/i, /\bnut\b/i],
  peanuts: [/peanut/i],
  eggs: [/\begg/i],
  soy: [/\bsoy/i, /tofu/i, /edamame/i, /tempeh/i],
  fish: [/\bfish\b/i, /salmon/i, /tuna/i, /cod\b/i, /anchov/i, /sardine/i, /trout/i, /mackerel/i, /halibut/i],
  shellfish: [/shrimp/i, /prawn/i, /crab/i, /lobster/i, /oyster/i, /clam/i, /mussel/i, /scallop/i, /squid/i, /octopus/i],
  sesame: [/sesame/i, /tahini/i],
};

const BREAKFAST_RATIO = 0.25;
const LUNCH_RATIO = 0.4;
const DINNER_RATIO = 0.35;

function perServingCalories(recipe) {
  const servings = Math.max(1, Number(recipe.servings) || 1);
  return Math.round((Number(recipe.calories) || 0) / servings);
}

function totalTime(recipe) {
  return (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0);
}

function anyPatternMatches(patterns, text) {
  if (!text) return false;
  return patterns.some((re) => re.test(text));
}

function recipeContainsPattern(recipe, patterns) {
  if (!patterns.length) return false;
  const ingredients = recipe.ingredients || [];
  for (const ing of ingredients) {
    if (anyPatternMatches(patterns, ing?.name || '')) return true;
  }
  if (anyPatternMatches(patterns, recipe.title || '')) return true;
  const tagText = (recipe.tags || []).join(' ');
  if (anyPatternMatches(patterns, tagText)) return true;
  return false;
}

function recipeContainsTreatSignals(recipe) {
  return recipeContainsPattern(recipe, TREAT_EXCLUDE_PATTERNS);
}

function buildRestrictionFilters(user) {
  const prefs = user?.preferences || {};
  const restrictions = prefs.dietaryRestrictions || [];
  const allergies = prefs.allergies || [];

  const blockedCategories = new Set(EXCLUDED_CATEGORIES);
  const blockedPatterns = [];

  for (const key of restrictions) {
    const rule = DIETARY_RULES[key];
    if (!rule) continue;
    rule.categories.forEach((c) => blockedCategories.add(c));
    blockedPatterns.push(...rule.ingredientPatterns);
  }

  const allergyPatterns = [];
  for (const key of allergies) {
    const patterns = ALLERGY_PATTERNS[key];
    if (patterns) allergyPatterns.push(...patterns);
  }

  return { blockedCategories, blockedPatterns, allergyPatterns };
}

function isRecipeAllowed(recipe, filters) {
  if (!recipe) return false;
  if (!(Number(recipe.calories) > 0)) return false;
  if (!(Number(recipe.servings) > 0)) return false;
  if (filters.blockedCategories.has(recipe.category)) return false;
  if (recipeContainsTreatSignals(recipe)) return false;
  if (recipeContainsPattern(recipe, filters.allergyPatterns)) return false;
  if (recipeContainsPattern(recipe, filters.blockedPatterns)) return false;
  return true;
}

/** Tag "breakfast" (any casing) → use only in the breakfast slot, not lunch/dinner. */
function hasBreakfastTag(recipe) {
  return (recipe.tags || []).some(
    (t) => String(t || '').toLowerCase().trim() === 'breakfast'
  );
}

function isBreakfastOnlyRecipe(recipe) {
  return (
    BREAKFAST_CATEGORIES.includes(recipe.category) || hasBreakfastTag(recipe)
  );
}

function normalizeIngredient(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\b(fresh|dried|chopped|minced|sliced|grated|ground|whole|small|large|medium)\b/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ingredientNames(recipe) {
  return (recipe.ingredients || [])
    .map((ing) => normalizeIngredient(ing?.name || ''))
    .filter(Boolean);
}

// Is a recipe ingredient covered by any item already in the known set?
// knownSet contains normalized names (from fridge + previously picked recipes).
// We accept substring matches only for tokens >= 3 chars to avoid "oil"
// greedily matching everything.
function ingredientCoveredBy(name, knownSet) {
  if (!name) return false;
  if (knownSet.has(name)) return true;
  for (const item of knownSet) {
    if (item.length < 3 || name.length < 3) continue;
    if (name.includes(item) || item.includes(name)) return true;
  }
  return false;
}

// Fraction of this recipe's ingredients that would NOT add a new item to the
// shopping list (either already in the fridge or shared with previously
// picked recipes in this plan).
function coverageScore(recipe, knownSet) {
  const names = ingredientNames(recipe);
  if (!names.length) return 0;
  let covered = 0;
  for (const name of names) {
    if (ingredientCoveredBy(name, knownSet)) covered += 1;
  }
  return covered / names.length;
}

// Count how many *new* ingredients a recipe would add if we picked it.
function newIngredientsIntroduced(recipe, knownSet) {
  const names = ingredientNames(recipe);
  let count = 0;
  for (const name of names) {
    if (!ingredientCoveredBy(name, knownSet)) count += 1;
  }
  return count;
}

function calorieFitScore(recipe, target) {
  if (!target) return 0.5;
  const kcal = perServingCalories(recipe);
  const diff = Math.abs(kcal - target);
  const score = 1 - diff / target;
  return Math.max(0, Math.min(1, score));
}

function noveltyScore(recipeId, recentPlan, recentLogs) {
  const inPlan = recentPlan.has(String(recipeId));
  const inLogs = recentLogs.has(String(recipeId));
  if (inPlan) return 0;
  if (inLogs) return 0.1;
  return 1;
}

function varietyScore(recipe, planCategoryUsage, planAreaUsage, days) {
  const cat = recipe.category || '';
  const area = recipe.area || '';
  const catUsed = planCategoryUsage.get(cat) || 0;
  const areaUsed = planAreaUsage.get(area) || 0;
  // every category is allowed ~ days / 3 times max before starting to hurt
  const catPenalty = Math.min(1, catUsed / Math.max(2, Math.round(days / 3)));
  const areaPenalty = Math.min(1, areaUsed / Math.max(2, Math.round(days / 3)));
  return 1 - 0.6 * catPenalty - 0.4 * areaPenalty;
}

function timeFitScore(recipe, mealType, isWeekend) {
  const total = totalTime(recipe);
  if (isWeekend) {
    // weekends allow longer recipes; only massive outliers hurt
    return total > 180 ? 0.5 : 1;
  }
  const thresholds = {
    breakfast: 25,
    lunch: 45,
    dinner: 45,
    snack: 15,
  };
  const limit = thresholds[mealType] || 45;
  if (total <= limit) return 1;
  if (total <= limit * 1.5) return 0.7;
  if (total <= limit * 2) return 0.4;
  return 0.15;
}

function healthBonus(recipe) {
  const text = `${recipe.title || ''} ${(recipe.tags || []).join(' ')}`;
  return anyPatternMatches(UNHEALTHY_TAG_PATTERNS, text) ? 0 : 1;
}

// Coverage is the biggest lever for keeping the shopping list short (<25
// items/week). Calorie fit and health still matter, but we deliberately lean
// on reuse of ingredients across the week.
const WEIGHTS = {
  calories: 0.25,
  coverage: 0.3,
  novelty: 0.15,
  variety: 0.1,
  time: 0.1,
  health: 0.1,
};

function weightedRandomPick(scored) {
  const total = scored.reduce((sum, s) => sum + s.score, 0);
  if (total <= 0) {
    return scored[Math.floor(Math.random() * scored.length)];
  }
  let r = Math.random() * total;
  for (const s of scored) {
    r -= s.score;
    if (r <= 0) return s;
  }
  return scored[scored.length - 1];
}

function pickForSlot({
  pool,
  target,
  mealType,
  isWeekend,
  knownIngredients,
  recentPlan,
  recentLogs,
  planCategoryUsage,
  planAreaUsage,
  days,
  dayExcludes,
}) {
  const available = pool.filter((r) => !dayExcludes.has(String(r._id)));
  if (available.length === 0) return null;

  const scored = available.map((recipe) => {
    const calories = calorieFitScore(recipe, target);
    const novelty = noveltyScore(recipe._id, recentPlan, recentLogs);
    const variety = varietyScore(recipe, planCategoryUsage, planAreaUsage, days);
    const time = timeFitScore(recipe, mealType, isWeekend);
    const coverage = coverageScore(recipe, knownIngredients);
    const health = healthBonus(recipe);
    const base =
      calories * WEIGHTS.calories +
      coverage * WEIGHTS.coverage +
      novelty * WEIGHTS.novelty +
      variety * WEIGHTS.variety +
      time * WEIGHTS.time +
      health * WEIGHTS.health;
    const jitter = (Math.random() - 0.5) * 0.04;
    return { recipe, score: Math.max(0.001, base + jitter) };
  });

  scored.sort((a, b) => b.score - a.score);
  const topN = scored.slice(0, Math.min(8, scored.length));
  const picked = weightedRandomPick(topN);
  return picked ? picked.recipe : null;
}

// Count distinct ingredients in the plan that are NOT already in the fridge.
// This is a very close approximation of the shopping-list size.
function countPlannedShoppingItems(planDays, fridgeSet) {
  const distinct = new Set();
  for (const day of planDays) {
    for (const meal of day.meals) {
      const names = ingredientNames(meal._recipe || {});
      for (const name of names) {
        if (!name) continue;
        if (ingredientCoveredBy(name, fridgeSet)) continue;
        let alreadyTracked = false;
        for (const existing of distinct) {
          if (existing === name) {
            alreadyTracked = true;
            break;
          }
          if (
            existing.length >= 3 &&
            name.length >= 3 &&
            (existing.includes(name) || name.includes(existing))
          ) {
            alreadyTracked = true;
            break;
          }
        }
        if (!alreadyTracked) distinct.add(name);
      }
    }
  }
  return distinct.size;
}

function runSingleGeneration({
  dailyGoal,
  bFallback,
  mFallback,
  fridgeSet,
  recentLogs,
  startDate,
  days,
}) {
  const recentWindow = [];
  const recentLimit = 6;
  const planCategoryUsage = new Map();
  const planAreaUsage = new Map();
  // Known = fridge items + ingredients from recipes we've already picked in
  // this plan. Recipes that reuse known ingredients are preferred.
  const knownIngredients = new Set(fridgeSet);

  const start = startDate ? new Date(startDate) : new Date();

  const generated = Array.from({ length: days }).map((_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    const recentPlan = new Set(recentWindow);
    const dayExcludes = new Set(recentPlan);

    const bTarget = Math.round(dailyGoal * BREAKFAST_RATIO);
    const dTarget = Math.round(dailyGoal * DINNER_RATIO);

    const commonArgs = {
      isWeekend,
      knownIngredients,
      recentPlan,
      recentLogs,
      planCategoryUsage,
      planAreaUsage,
      days,
    };

    const breakfast =
      pickForSlot({
        ...commonArgs,
        pool: bFallback,
        target: bTarget,
        mealType: 'breakfast',
        dayExcludes,
      }) ||
      pickForSlot({
        ...commonArgs,
        recentPlan: new Set(),
        recentLogs: new Set(),
        pool: bFallback,
        target: bTarget,
        mealType: 'breakfast',
        dayExcludes: new Set(),
      });
    if (breakfast) {
      dayExcludes.add(String(breakfast._id));
      for (const n of ingredientNames(breakfast)) knownIngredients.add(n);
    }

    const dinner =
      pickForSlot({
        ...commonArgs,
        pool: mFallback,
        target: dTarget,
        mealType: 'dinner',
        dayExcludes,
      }) ||
      pickForSlot({
        ...commonArgs,
        recentPlan: new Set(),
        recentLogs: new Set(),
        pool: mFallback,
        target: dTarget,
        mealType: 'dinner',
        dayExcludes: new Set([String(breakfast?._id)]),
      });
    if (dinner) {
      dayExcludes.add(String(dinner._id));
      for (const n of ingredientNames(dinner)) knownIngredients.add(n);
    }

    const lunchTarget =
      dailyGoal -
      (breakfast ? perServingCalories(breakfast) : 0) -
      (dinner ? perServingCalories(dinner) : 0);
    const lunch =
      pickForSlot({
        ...commonArgs,
        pool: mFallback,
        target: lunchTarget > 0 ? lunchTarget : Math.round(dailyGoal * LUNCH_RATIO),
        mealType: 'lunch',
        dayExcludes,
      }) ||
      pickForSlot({
        ...commonArgs,
        recentPlan: new Set(),
        recentLogs: new Set(),
        pool: mFallback,
        target: Math.round(dailyGoal * LUNCH_RATIO),
        mealType: 'lunch',
        dayExcludes: new Set([
          String(breakfast?._id),
          String(dinner?._id),
        ]),
      });
    if (lunch) {
      for (const n of ingredientNames(lunch)) knownIngredients.add(n);
    }

    const chosen = [breakfast, lunch, dinner].filter(Boolean);
    for (const r of chosen) {
      recentWindow.push(String(r._id));
      planCategoryUsage.set(
        r.category || '',
        (planCategoryUsage.get(r.category || '') || 0) + 1
      );
      planAreaUsage.set(
        r.area || '',
        (planAreaUsage.get(r.area || '') || 0) + 1
      );
    }
    while (recentWindow.length > recentLimit) recentWindow.shift();

    const meals = [];
    // Keep the recipe object attached so we can evaluate the shopping list
    // size of this candidate plan before returning it.
    if (breakfast) meals.push({ type: 'breakfast', recipe: breakfast._id, _recipe: breakfast });
    if (lunch) meals.push({ type: 'lunch', recipe: lunch._id, _recipe: lunch });
    if (dinner) meals.push({ type: 'dinner', recipe: dinner._id, _recipe: dinner });

    return { date, meals };
  });

  return generated;
}

const SHOPPING_LIST_TARGET = 25; // weekly sweet-spot
const BEST_OF_N = 4;

function generatePlanDays({
  user,
  recipes,
  fridgeItems,
  recentLogIds,
  startDate,
  days,
}) {
  const filters = buildRestrictionFilters(user);
  const dailyGoal = Number(user?.preferences?.dailyCalorieGoal) || 2000;

  const allowed = recipes.filter((r) => isRecipeAllowed(r, filters));
  if (allowed.length === 0) {
    return { error: 'No recipes match your dietary profile.' };
  }

  const breakfastPool = allowed.filter(isBreakfastOnlyRecipe);
  const mainPool = allowed.filter((r) => !isBreakfastOnlyRecipe(r));
  const bFallback = breakfastPool.length > 0 ? breakfastPool : allowed;
  const mFallback = mainPool.length > 0 ? mainPool : allowed;

  const fridgeSet = new Set(
    (fridgeItems || [])
      .map((f) => normalizeIngredient(f?.name || ''))
      .filter(Boolean)
  );
  const recentLogs = new Set(recentLogIds.map(String));

  let best = null;
  for (let attempt = 0; attempt < BEST_OF_N; attempt += 1) {
    const generated = runSingleGeneration({
      dailyGoal,
      bFallback,
      mFallback,
      fridgeSet,
      recentLogs,
      startDate,
      days,
    });
    const shoppingSize = countPlannedShoppingItems(generated, fridgeSet);
    if (!best || shoppingSize < best.shoppingSize) {
      best = { generated, shoppingSize };
    }
    // Early exit: good enough.
    if (best.shoppingSize <= SHOPPING_LIST_TARGET) break;
  }

  // Strip the helper `_recipe` field before persisting.
  const cleaned = best.generated.map((day) => ({
    date: day.date,
    meals: day.meals.map(({ _recipe, ...meal }) => meal),
  }));

  return {
    days: cleaned,
    shoppingSize: best.shoppingSize,
  };
}

module.exports = {
  generatePlanDays,
  perServingCalories,
  isRecipeAllowed,
  buildRestrictionFilters,
};
