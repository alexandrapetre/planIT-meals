// Meal Plan Generation — Stochastic Multi-Objective Heuristic
//
// ALGORITHM OVERVIEW:
//   A stochastic local-search heuristic with multi-objective scoring, designed
//   to produce nutritionally balanced weekly plans that minimise the number of
//   distinct shopping items.
//
// PHASE 1 — HARD FILTERING:
//   All recipes are subjected to hard constraint elimination before any scoring:
//   - Dietary rules (vegetarian, vegan, gluten-free, keto, etc.) remove recipes
//     by category and ingredient pattern matching using regular expressions.
//   - Allergy filters apply the same mechanism for nut, egg, shellfish, etc.
//   - Compactness pre-filter: recipes exceeding MAX_RECIPE_INGREDIENTS are removed.
//     If fewer than 10 compact recipes remain, the full allowed set is used as
//     fallback to avoid generation failure.
//
// PHASE 2 — CANDIDATE GENERATION (Monte Carlo, BEST_OF_N simulations):
//   Each simulation builds a full 7-day plan:
//
//   Breakfast Roster:
//     Two breakfast recipes are selected via inverse-size weighted random sampling
//     (without replacement).  P(select r) ∝ 1 / (|ingredients(r)| + 1).
//     This biases selection toward simpler recipes while preserving randomness.
//     All breakfast ingredient keys are pre-registered into the known-ingredient
//     set K so subsequent lunch/dinner scoring treats them as already owned —
//     limiting the breakfast contribution to the shopping list to at most
//     2 recipes' worth regardless of how many days are planned.
//
//   Per-Slot Scoring (Lunch & Dinner):
//     Each candidate recipe r is scored as a weighted sum:
//
//       S(r) = w_cal·cal(r) + w_cov·cov(r,K) + w_cp·compact(r,K)
//            + w_n·novelty(r) + w_v·variety(r) + w_t·time(r) + w_h·health(r)
//
//     Weights (must sum to 1.0):
//       compactness  0.30  — 1 − ΔK_r/budget; ΔK_r = new merge keys introduced.
//                            DYNAMIC: as |K| grows the remaining budget shrinks,
//                            making the penalty for new ingredients progressively
//                            stricter as the week fills up.
//       coverage     0.20  — fraction of r's keys already in K (ingredient reuse).
//       novelty      0.15  — 0 if already in plan this week, 0.1 if recently logged.
//       calories     0.15  — proximity to the slot's calorie target.
//       variety      0.10  — penalises over-represented cuisine categories/areas.
//       time         0.05  — prep+cook time fit for the slot and day type.
//       health       0.05  — binary penalty for "fried", "bacon", etc.
//
//     A uniform random jitter ξ ~ U(−0.15, +0.15) is added to each score to
//     break ties and diversify plans across independent simulations.
//     The top 20 candidates enter a proportional (roulette-wheel) weighted-random
//     draw, ensuring any competitive recipe can be selected.
//
// PHASE 3 — PLAN SELECTION:
//   After all BEST_OF_N simulations, candidates whose total shopping size ≤
//   WEEKLY_INGREDIENT_TARGET are collected into an acceptable set.  A plan is
//   randomly selected from this set (not the strict minimum) to ensure output
//   diversity between calls.  If no candidate meets the target, the one with
//   the fewest items is returned.  A Phase 2 retry loop (up to BEST_OF_N extra
//   attempts) handles edge cases with very restricted recipe pools.
//
// INGREDIENT TRACKING:
//   Every ingredient is identified by a "merge key" produced by
//   shoppingMergeContribution() — e.g. "chicken breast::GRAMS", "garlic::CLOVE".
//   This is the exact same key used in the shopping list endpoint so the
//   planner's ingredient count is always consistent with what the user sees.


// Categories that are never planned regardless of user preferences.
const EXCLUDED_CATEGORIES = ['Dessert', 'Side'];
// Recipes in these categories (or with a "breakfast" tag) go ONLY into the
// breakfast slot and are never offered for lunch or dinner.
const BREAKFAST_CATEGORIES = ['Breakfast'];
// Recipes whose title / tags match these patterns lose their healthBonus.
const UNHEALTHY_TAG_PATTERNS = [/fried/i, /deep.?fry/i, /bacon/i];
// Recipes that match these patterns are excluded completely (treat / dessert
// recipes that slipped into a non-Dessert category in the DB).
const TREAT_EXCLUDE_PATTERNS = [/chocolate/i, /\bcakes?\b/i];

const { shoppingMergeContribution } = require('../utils/ingredientShoppingKey');

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

// Calorie split across the three daily meal slots.
// These fractions of the user's dailyCalorieGoal become the calorie targets
// passed to calorieFitScore() for each slot.
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

// Returns the merge keys for all ingredients in a recipe (scaled to per-serving).
// Using merge keys aligns the scoring system with countPlannedShoppingItems so
// the compactness score is an accurate predictor of the real shopping list size.
// Example merge key: "chicken breast::GRAMS", "olive oil::VOL", "garlic::CLOVES"
function ingredientMergeKeys(recipe) {
  const servings = Math.max(1, Number(recipe.servings) || 1);
  return (recipe.ingredients || [])
    .map((ing) => {
      if (!ing?.name) return null;
      const perServing = (Number(ing.quantity) || 0) / servings;
      // Use 'g' as fallback unit — must match countPlannedShoppingItems so that
      // the same ingredient with a missing unit produces the same merge key in
      // both the scoring system and the actual shopping-list counter.
      const { key } = shoppingMergeContribution(ing.name, perServing, ing.unit || 'g');
      return key;
    })
    .filter(Boolean);
}

// Fraction of this recipe's ingredients already covered by knownSet (merge keys).
// 1.0 means every ingredient is already in the fridge or used by an earlier
// recipe this week → zero new shopping items needed.
// 0.0 means every ingredient is brand-new.
function coverageScore(recipe, knownSet) {
  const keys = ingredientMergeKeys(recipe);
  if (!keys.length) return 0;
  return keys.filter((k) => knownSet.has(k)).length / keys.length;
}

// How many NEW merge keys this recipe would add to the known set.
// This is the absolute cost of picking this recipe in terms of shopping items.
// Used to compute the compactness score relative to the remaining weekly budget.
function newIngredientsIntroduced(recipe, knownSet) {
  return ingredientMergeKeys(recipe).filter((k) => !knownSet.has(k)).length;
}

// How close is this recipe's per-serving calorie count to the slot target?
// Returns 1.0 when exact, 0.0 when the recipe is 100% above/below target.
// The target itself comes from dailyCalorieGoal × BREAKFAST/LUNCH/DINNER_RATIO.
function calorieFitScore(recipe, target) {
  if (!target) return 0.5;
  const kcal = perServingCalories(recipe);
  const diff = Math.abs(kcal - target);
  const score = 1 - diff / target;
  return Math.max(0, Math.min(1, score));
}

// Penalise recipes the user has eaten recently.
// inPlan  → recipe is already in the plan this week → score 0 (hard block).
// inLogs  → recipe was logged in the past 14 days   → score 0.1 (soft discourage).
// neither → score 1.0 (full novelty bonus).
function noveltyScore(recipeId, recentPlan, recentLogs) {
  const inPlan = recentPlan.has(String(recipeId));
  const inLogs = recentLogs.has(String(recipeId));
  if (inPlan) return 0;
  if (inLogs) return 0.1;
  return 1;
}

// Penalise overusing the same cuisine category (e.g. Chicken) or world area
// (e.g. Italian) within the same plan. Each category/area is allowed roughly
// days/3 appearances before the penalty kicks in.
// Weights: category (60%) matters more than area (40%).
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

// Penalise recipes that take longer than the slot threshold on weekdays.
// Weekends are lenient (only hard-cap at 180 min). On weekdays:
//   ≤ limit      → 1.0   (fits perfectly)
//   ≤ limit×1.5  → 0.7   (slightly over, still acceptable)
//   ≤ limit×2    → 0.4   (noticeably over)
//   > limit×2    → 0.15  (too long, strongly discouraged)
// Slot limits: breakfast 25 min, lunch/dinner 45 min, snack 15 min.
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

// Returns 0 if the recipe title/tags match an unhealthy pattern (fried, bacon…),
// 1 otherwise. Acts as a binary penalty, not a gradient.
function healthBonus(recipe) {
  const text = `${recipe.title || ''} ${(recipe.tags || []).join(' ')}`;
  return anyPatternMatches(UNHEALTHY_TAG_PATTERNS, text) ? 0 : 1;
}

// Scoring weights — must sum to 1.0.
//
// compactness (0.30) — highest weight because it directly controls how many
//   new shopping items this recipe would add relative to the remaining weekly
//   budget. This is the primary knob for keeping the list ≤55 items.
//
// coverage (0.20) — rewards ingredient reuse (ratio of already-known ingredients).
//   Works together with compactness: compactness looks at absolute new count,
//   coverage looks at the fraction already known.
//
// novelty (0.15) — prevents the same recipe appearing multiple times in a week
//   or repeating meals the user recently tracked.
//
// calories (0.15) — soft calorie-target fit per slot.
//
// variety (0.10) — discourages overusing the same cuisine/area.
//
// time (0.05) — soft prep+cook time fit for the time of day / weekday.
//
// health (0.05) — small bonus for recipes without "fried", "bacon" etc.
const WEIGHTS = {
  calories: 0.15,
  coverage: 0.2,    // fraction of ingredients already known
  compactness: 0.3, // penalises recipes that introduce many new ingredients
  novelty: 0.15,
  variety: 0.1,
  time: 0.05,
  health: 0.05,
};

// Weighted-random selection from a pre-sorted scored list.
// Higher-scored items are proportionally more likely to be chosen, but any
// item in the list can win — this prevents the algorithm from always picking
// the single best-scoring recipe and producing identical plans.
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

// Pick one recipe for a single meal slot.
//
// Steps:
//   1. Filter the pool to recipes not already used today (dayExcludes).
//   2. Score every remaining recipe using the six weighted signals above.
//      The compactness score is dynamic: as knownIngredients grows during
//      the week the remaining budget (WEEKLY_INGREDIENT_TARGET - knownSize)
//      shrinks, making the penalty for adding new items progressively steeper.
//   3. Add random jitter (±0.15) so the same recipe doesn't always win when
//      scores are close — this is what makes each generated plan different.
//   4. Sort descending, take the top 15, do a weighted-random draw.
//   Returns null only if the pool is empty after exclusions.
function pickForSlot({
  pool,
  target,
  minimumCalories = 0,
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

  // If at least one recipe can satisfy the minimum required calories for this
  // slot, restrict selection to those recipes. This acts as a hard guardrail
  // when the remaining day total must still reach the user's configured goal.
  const calorieQualified =
    minimumCalories > 0
      ? available.filter((recipe) => perServingCalories(recipe) >= minimumCalories)
      : [];
  const effectivePool = calorieQualified.length > 0 ? calorieQualified : available;

  const scored = effectivePool.map((recipe) => {
    const calories = calorieFitScore(recipe, target);
    const novelty = noveltyScore(recipe._id, recentPlan, recentLogs);
    const variety = varietyScore(recipe, planCategoryUsage, planAreaUsage, days);
    const time = timeFitScore(recipe, mealType, isWeekend);
    const coverage = coverageScore(recipe, knownIngredients);
    const health = healthBonus(recipe);
    // Dynamic compactness: how many new items would this recipe add vs how
    // many slots remain in the weekly ingredient budget?
    // When the budget is almost full (remaining → 1) even adding 1 new
    // ingredient gives compactness → 0, strongly discouraging the pick.
    const newCount = newIngredientsIntroduced(recipe, knownIngredients);
    const remaining = Math.max(1, WEEKLY_INGREDIENT_TARGET - knownIngredients.size);
    const compactness = Math.max(0, 1 - newCount / remaining);
    const base =
      calories * WEIGHTS.calories +
      coverage * WEIGHTS.coverage +
      compactness * WEIGHTS.compactness +
      novelty * WEIGHTS.novelty +
      variety * WEIGHTS.variety +
      time * WEIGHTS.time +
      health * WEIGHTS.health;
    // Jitter breaks ties and ensures different plans on each generation call.
    // ±0.15 is large enough to meaningfully shuffle close-scoring recipes but
    // small enough that a clearly dominant recipe (score diff > 0.15) still wins.
    const jitter = (Math.random() - 0.5) * 0.3;
    return { recipe, score: Math.max(0.001, base + jitter) };
  });

  scored.sort((a, b) => b.score - a.score);
  // Top 15 candidates enter the weighted-random draw. Taking more than 1
  // prevents the algorithm from always picking the same top recipe while
  // still ensuring only competitive options can be chosen.
  const topN = scored.slice(0, Math.min(20, scored.length));
  const picked = weightedRandomPick(topN);
  return picked ? picked.recipe : null;
}

// Count how many distinct merge keys (= shopping list line items) the plan
// would require that are NOT already covered by the fridge.
// This is called on every candidate plan to decide which one is "best"
// (fewest items to buy). It uses the same shoppingMergeContribution logic
// as the real shopping list endpoint so the counts always match.
function countPlannedShoppingItems(planDays, fridgeSet) {
  // Use proper aggregation logic (same as shopping list) instead of naive string matching.
  // This accounts for unit normalization and specialized ingredient merging.
  const needed = new Map();

  for (const day of planDays) {
    for (const meal of day.meals) {
      const recipe = meal._recipe || {};
      const ingredients = recipe.ingredients || [];
      const servings = Math.max(1, recipe.servings || 1);

      for (const ing of ingredients) {
        if (!ing || !ing.name) continue;

        // Scale ingredient to per-serving and get merge key
        const perServing = (ing.quantity || 0) / servings;
        const { key, delta } = shoppingMergeContribution(
          ing.name,
          perServing,
          ing.unit || 'g'
        );

        // Skip if already in fridge
        if (fridgeSet.has(key)) continue;

        // Accumulate in the needed map
        needed.set(key, (needed.get(key) || 0) + delta);
      }
    }
  }

  // Count distinct merge keys needed to buy (that aren't in fridge)
  return needed.size;
}

function mealTypeTarget(mealType, dailyGoal) {
  if (mealType === 'breakfast') return Math.round(dailyGoal * BREAKFAST_RATIO);
  if (mealType === 'lunch') return Math.round(dailyGoal * LUNCH_RATIO);
  if (mealType === 'snack') return Math.round(dailyGoal * 0.15);
  return Math.round(dailyGoal * DINNER_RATIO);
}

function breakfastRosterWeight(recipe, dailyGoal) {
  const breakfastTarget = mealTypeTarget('breakfast', dailyGoal);
  const calorieScore = calorieFitScore(recipe, breakfastTarget);
  const simplicityScore = 1 / (((recipe.ingredients || []).length || 0) + 1);
  return Math.max(0.05, calorieScore * 0.7 + simplicityScore * 0.3);
}

function totalSelectedCalories(recipes) {
  return recipes.filter(Boolean).reduce((sum, recipe) => sum + perServingCalories(recipe), 0);
}

function pickSwapCandidate({
  user,
  recipes,
  fridgeItems,
  recentLogIds,
  plan,
  dayIndex,
  mealType,
}) {
  const targetDay = plan?.days?.[dayIndex];
  if (!targetDay) return { error: 'Invalid day.' };

  const targetMeal = (targetDay.meals || []).find((meal) => meal.type === mealType);
  if (!targetMeal) return { error: 'Meal not found.' };

  const filters = buildRestrictionFilters(user);
  const dailyGoal = Number(user?.preferences?.dailyCalorieGoal) || 2000;
  const allowed = recipes.filter((r) => isRecipeAllowed(r, filters));
  if (allowed.length === 0) return { error: 'No recipes match your dietary profile.' };

  const compact = allowed.filter((r) => (r.ingredients || []).length <= MAX_RECIPE_INGREDIENTS);
  const pool = compact.length >= 10 ? compact : allowed;

  const breakfastPool = pool.filter(isBreakfastOnlyRecipe);
  const mainPool = pool.filter((r) => !isBreakfastOnlyRecipe(r));

  const excludedRecipeIds = new Set();
  const knownIngredients = new Set();
  const planCategoryUsage = new Map();
  const planAreaUsage = new Map();

  for (const f of fridgeItems || []) {
    const { key } = shoppingMergeContribution(f?.name || '', f?.quantity || 0, f?.unit || 'g');
    knownIngredients.add(key);
  }

  for (const day of plan.days || []) {
    for (const meal of day.meals || []) {
      const recipe = meal.recipe;
      if (!recipe || typeof recipe !== 'object') continue;
      const recipeId = String(recipe._id || recipe);
      excludedRecipeIds.add(recipeId);
      if (day === targetDay && meal.type === mealType) continue;

      for (const key of ingredientMergeKeys(recipe)) knownIngredients.add(key);
      planCategoryUsage.set(
        recipe.category || '',
        (planCategoryUsage.get(recipe.category || '') || 0) + 1
      );
      planAreaUsage.set(
        recipe.area || '',
        (planAreaUsage.get(recipe.area || '') || 0) + 1
      );
    }
  }

  const isWeekend = (() => {
    const date = new Date(targetDay.date);
    const weekday = date.getDay();
    return weekday === 0 || weekday === 6;
  })();

  const candidatePools = mealType === 'breakfast'
    ? [
        breakfastPool.length > 0 ? breakfastPool : null,
        pool,
        allowed,
      ]
    : [
        mainPool.length > 0 ? mainPool : null,
        pool,
        allowed,
      ].filter(Boolean);

  let candidate = null;
  for (const candidatePool of candidatePools.filter(Boolean)) {
    candidate = pickForSlot({
      pool: candidatePool,
      target: mealTypeTarget(mealType, dailyGoal),
      mealType,
      isWeekend,
      knownIngredients,
      recentPlan: new Set(),
      recentLogs: new Set(recentLogIds.map(String)),
      planCategoryUsage,
      planAreaUsage,
      days: Math.max(1, plan.days?.length || 7),
      dayExcludes: excludedRecipeIds,
    });
    if (candidate) break;
  }

  if (!candidate) {
    return { error: 'No replacement recipe is available for this meal.' };
  }

  return { recipe: candidate };
}

// Generate one complete meal plan for `days` days.
//
// knownIngredients starts as a copy of the fridge merge keys so that
// lunch/dinner scoring immediately rewards recipes that use fridge items.
//
// BREAKFAST ROSTER:
//   Before the day loop, 2 low-ingredient breakfast recipes are chosen
//   (fewest ingredients wins, with jitter for variety). Their ingredients
//   are added to knownIngredients upfront. Each day just cycles through
//   the roster (day%2), so breakfast never adds new shopping items after
//   the first two picks.
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
  // Known = fridge merge keys + merge keys from recipes already picked this week.
  const knownIngredients = new Set(fridgeSet);

  const start = startDate ? new Date(startDate) : new Date();

  // ── Breakfast roster ─────────────────────────────────────────────────────
  // Pick 2 breakfasts upfront so they repeat across the 7 days — this keeps
  // the shopping list small (only 2 recipes' worth of breakfast ingredients).
  // Breakfasts are chosen with a mixed objective: reasonably close to the
  // breakfast calorie target, but still biased toward simpler recipes.
  const rosterSize = Math.min(2, bFallback.length);
  const breakfastRoster = [];
  const minimumBreakfastCalories = Math.round(dailyGoal * 0.18);
  const calorieQualifiedBreakfasts = bFallback.filter(
    (recipe) => perServingCalories(recipe) >= minimumBreakfastCalories
  );
  const breakfastPool = [
    ...(calorieQualifiedBreakfasts.length >= rosterSize
      ? calorieQualifiedBreakfasts
      : bFallback),
  ];
  for (let pick = 0; pick < rosterSize; pick += 1) {
    const totalWeight = breakfastPool.reduce(
      (sum, r) => sum + breakfastRosterWeight(r, dailyGoal),
      0
    );
    let rand = Math.random() * totalWeight;
    let chosen = null;
    for (let j = 0; j < breakfastPool.length; j += 1) {
      rand -= breakfastRosterWeight(breakfastPool[j], dailyGoal);
      if (rand <= 0) { chosen = j; break; }
    }
    if (chosen === null) chosen = breakfastPool.length - 1;
    breakfastRoster.push(breakfastPool[chosen]);
    breakfastPool.splice(chosen, 1); // no duplicates in the same roster
  }

  // Pre-register all roster ingredient keys so lunch/dinner scoring treats
  // them as already known and avoids introducing duplicate shopping items.
  // This is the key saving: after this loop knownIngredients already contains
  // ~10-15 keys, making subsequent dinner/lunch picks strongly prefer reuse.
  for (const b of breakfastRoster) {
    for (const k of ingredientMergeKeys(b)) knownIngredients.add(k);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const generated = Array.from({ length: days }).map((_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    // Randomly pick a breakfast from the roster each day — avoids Mon always
    // getting recipe A, Tue always getting recipe B, etc.
    const breakfast = breakfastRoster.length > 0
      ? breakfastRoster[Math.floor(Math.random() * breakfastRoster.length)]
      : null;

    const recentPlan = new Set(recentWindow);
    const dayExcludes = new Set(recentPlan);
    if (breakfast) {
      dayExcludes.add(String(breakfast._id));
      planCategoryUsage.set(breakfast.category || '', (planCategoryUsage.get(breakfast.category || '') || 0) + 1);
      planAreaUsage.set(breakfast.area || '', (planAreaUsage.get(breakfast.area || '') || 0) + 1);
    }

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

    let dinner =
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

    const knownWithDinner = new Set(knownIngredients);
    if (dinner) {
      dayExcludes.add(String(dinner._id));
      for (const k of ingredientMergeKeys(dinner)) knownWithDinner.add(k);
    }

    const lunchTarget =
      dailyGoal -
      (breakfast ? perServingCalories(breakfast) : 0) -
      (dinner ? perServingCalories(dinner) : 0);
    let lunch =
      pickForSlot({
        ...commonArgs,
        knownIngredients: knownWithDinner,
        pool: mFallback,
        target: lunchTarget > 0 ? lunchTarget : Math.round(dailyGoal * LUNCH_RATIO),
        minimumCalories: lunchTarget > 0 ? lunchTarget : 0,
        mealType: 'lunch',
        dayExcludes,
      }) ||
      pickForSlot({
        ...commonArgs,
        knownIngredients: knownWithDinner,
        recentPlan: new Set(),
        recentLogs: new Set(),
        pool: mFallback,
        target: Math.round(dailyGoal * LUNCH_RATIO),
        minimumCalories: lunchTarget > 0 ? lunchTarget : 0,
        mealType: 'lunch',
        dayExcludes: new Set([
          String(breakfast?._id),
          String(dinner?._id),
        ]),
      });

    let dayTotalCalories = totalSelectedCalories([breakfast, lunch, dinner]);
    if (dayTotalCalories < dailyGoal && lunch) {
      const lunchUpgradeTarget = perServingCalories(lunch) + (dailyGoal - dayTotalCalories);
      const upgradedLunch =
        pickForSlot({
          ...commonArgs,
          knownIngredients: knownWithDinner,
          pool: mFallback,
          target: lunchUpgradeTarget,
          minimumCalories: lunchUpgradeTarget,
          mealType: 'lunch',
          dayExcludes: new Set([String(breakfast?._id), String(dinner?._id)]),
        }) ||
        pickForSlot({
          ...commonArgs,
          knownIngredients: knownWithDinner,
          recentPlan: new Set(),
          recentLogs: new Set(),
          pool: mFallback,
          target: lunchUpgradeTarget,
          minimumCalories: lunchUpgradeTarget,
          mealType: 'lunch',
          dayExcludes: new Set([String(breakfast?._id), String(dinner?._id)]),
        });
      if (upgradedLunch) {
        lunch = upgradedLunch;
        dayTotalCalories = totalSelectedCalories([breakfast, lunch, dinner]);
      }
    }

    const knownWithLunch = new Set(knownIngredients);
    if (lunch) {
      for (const k of ingredientMergeKeys(lunch)) knownWithLunch.add(k);
    }

    if (dayTotalCalories < dailyGoal && dinner) {
      const dinnerUpgradeTarget = perServingCalories(dinner) + (dailyGoal - dayTotalCalories);
      const upgradedDinner =
        pickForSlot({
          ...commonArgs,
          knownIngredients: knownWithLunch,
          pool: mFallback,
          target: dinnerUpgradeTarget,
          minimumCalories: dinnerUpgradeTarget,
          mealType: 'dinner',
          dayExcludes: new Set([String(breakfast?._id), String(lunch?._id)]),
        }) ||
        pickForSlot({
          ...commonArgs,
          knownIngredients: knownWithLunch,
          recentPlan: new Set(),
          recentLogs: new Set(),
          pool: mFallback,
          target: dinnerUpgradeTarget,
          minimumCalories: dinnerUpgradeTarget,
          mealType: 'dinner',
          dayExcludes: new Set([String(breakfast?._id), String(lunch?._id)]),
        });
      if (upgradedDinner) {
        dinner = upgradedDinner;
      }
    }

    if (dinner) {
      for (const k of ingredientMergeKeys(dinner)) knownIngredients.add(k);
    }
    if (lunch) {
      for (const k of ingredientMergeKeys(lunch)) knownIngredients.add(k);
    }

    // Track lunch/dinner in usage maps; add all three to recentWindow.
    for (const r of [lunch, dinner].filter(Boolean)) {
      planCategoryUsage.set(r.category || '', (planCategoryUsage.get(r.category || '') || 0) + 1);
      planAreaUsage.set(r.area || '', (planAreaUsage.get(r.area || '') || 0) + 1);
    }
    for (const r of [breakfast, lunch, dinner].filter(Boolean)) {
      recentWindow.push(String(r._id));
    }
    while (recentWindow.length > recentLimit) recentWindow.shift();

    const meals = [];
    if (breakfast) meals.push({ type: 'breakfast', recipe: breakfast._id, _recipe: breakfast });
    if (lunch) meals.push({ type: 'lunch', recipe: lunch._id, _recipe: lunch });
    if (dinner) meals.push({ type: 'dinner', recipe: dinner._id, _recipe: dinner });

    return { date, meals };
  });

  return generated;
}

const BEST_OF_N = 8; // Generates N plan candidates and returns the one with smallest shopping list
const WEEKLY_INGREDIENT_TARGET = 55; // target ≤55 unique ingredients for the whole week
const MAX_RECIPE_INGREDIENTS = 15; // skip recipes with more ingredients than this

// Entry point called by mealPlanController.
//
// Pipeline:
//   1. Filter recipes by dietary rules + allergy patterns.
//   2. Further restrict to "compact" recipes (≤MAX_RECIPE_INGREDIENTS).
//      Falls back to the full allowed set if fewer than 10 compact recipes exist.
//   3. Split into breakfast pool (category=Breakfast or tag=breakfast) and
//      main pool (everything else).
//   4. Build the fridge merge-key set so the planner can account for what the
//      user already owns.
//   5. Run BEST_OF_N independent generations (Phase 1) — always all of them
//      so the returned plan is randomly different each call.
//   6. If the best plan found is still above WEEKLY_INGREDIENT_TARGET, run
//      up to BEST_OF_N bonus attempts (Phase 2) to try to hit the cap.
//   7. Return the plan with the fewest shopping items found.
//
// Returns { days, shoppingSize } where shoppingSize is informational (shown
// in the API response header). The hard shopping-list deduction happens later
// in getShoppingList via aggregateShoppingMap.
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

  // Prefer compact recipes (≤MAX_RECIPE_INGREDIENTS); fall back to full set if too few remain.
  // A recipe with 15 ingredients alone uses a significant share of the weekly budget;
  // capping at MAX_RECIPE_INGREDIENTS prevents any single recipe from dominating the shopping list.
  const compact = allowed.filter((r) => (r.ingredients || []).length <= MAX_RECIPE_INGREDIENTS);
  const pool = compact.length >= 10 ? compact : allowed;

  const breakfastPool = pool.filter(isBreakfastOnlyRecipe);
  const mainPool = pool.filter((r) => !isBreakfastOnlyRecipe(r));
  const bFallback = breakfastPool.length > 0 ? breakfastPool : pool;
  const mFallback = mainPool.length > 0 ? mainPool : pool;

  // Build fridge merge-key set from the user's current fridge inventory.
  // Using real quantity + unit (fetched with .select('name quantity unit') in
  // mealPlanController) ensures the merge keys match those produced by the
  // shopping list endpoint, so fridge items are correctly deducted.
  const fridgeSet = new Set();
  for (const f of fridgeItems || []) {
    const { key } = shoppingMergeContribution(f?.name || '', f?.quantity || 0, f?.unit || 'g');
    fridgeSet.add(key);
  }

  const recentLogs = new Set(recentLogIds.map(String));

  // Phase 1: run ALL BEST_OF_N candidates and collect those within the target.
  // We then randomly pick from acceptable candidates so the plan is different
  // every time — not always the same "minimum" compact plan.
  const candidates = [];
  for (let i = 0; i < BEST_OF_N; i += 1) {
    const generated = runSingleGeneration({ dailyGoal, bFallback, mFallback, fridgeSet, recentLogs, startDate, days });
    const shoppingSize = countPlannedShoppingItems(generated, fridgeSet);
    candidates.push({ generated, shoppingSize });
  }

  // Prefer candidates that meet the weekly ingredient target.
  const acceptable = candidates.filter((c) => c.shoppingSize <= WEEKLY_INGREDIENT_TARGET);
  let best;
  if (acceptable.length > 0) {
    // Randomly pick any acceptable plan — variety over frugality.
    best = acceptable[Math.floor(Math.random() * acceptable.length)];
  } else {
    // No candidate met the target; take the smallest we have.
    best = candidates.reduce((a, b) => (b.shoppingSize < a.shoppingSize ? b : a));
  }

  // Phase 2: if even the best candidate exceeds the hard cap, keep trying.
  // This handles edge cases where the recipe pool is limited (e.g. many
  // dietary restrictions) and all BEST_OF_N attempts land above 35.
  let extra = 0;
  while (best.shoppingSize > WEEKLY_INGREDIENT_TARGET && extra < BEST_OF_N) {
    const generated = runSingleGeneration({ dailyGoal, bFallback, mFallback, fridgeSet, recentLogs, startDate, days });
    const shoppingSize = countPlannedShoppingItems(generated, fridgeSet);
    if (shoppingSize < best.shoppingSize) best = { generated, shoppingSize };
    extra += 1;
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
  pickSwapCandidate,
  perServingCalories,
  isRecipeAllowed,
  buildRestrictionFilters,
};
