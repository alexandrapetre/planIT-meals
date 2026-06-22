/**
 * Shopping list aggregation for a meal plan.
 *
 * Algorithm:
 * 1. Loop every day in the plan → every meal → every ingredient row on that recipe.
 * 2. Scale each row to one serving: quantity / recipe.servings.
 * 3. Turn (ingredient name, unit) into a stable merge key via shoppingMergeContribution
 *    so "Tomato" / "tomatoes" / "Butter" + tbsp + g land in one bucket per logical item.
 * 4. Keep a Map: mergeKey → { name, kind, quantity, displayUnit }. If the key exists,
 *    add the new delta to quantity; otherwise create the entry.
 * 5. Fridge rows use the same merge keys so we subtract in the same units.
 */

const {
  shoppingMergeContribution,
  titleCaseWords,
  normalizeIngredientBaseName,
} = require('./ingredientShoppingKey');

/**
 * @param {*} plan - Meal plan with `days[].meals[].recipe` populated (ingredients + servings)
 * @returns {Map<string, { name: string, kind: string, quantity: number, displayUnit?: string }>}
 */
function aggregateNeededFromPlan(plan) {
  const needed = new Map();

  if (!plan?.days?.length) return needed;

  for (const day of plan.days) {
    if (!day?.meals?.length) continue;

    for (const meal of day.meals) {
      const recipe = meal.recipe;
      if (!recipe?.ingredients?.length) continue;

      const servings = Math.max(1, Number(recipe.servings) || 1);

      for (const ing of recipe.ingredients) {
        const perServing = (Number(ing.quantity) || 0) / servings;
        const { key, delta, kind, displayUnit, canonicalDisplayName } =
          shoppingMergeContribution(ing.name, perServing, ing.unit);

        const rawLabel = (ing.name || '').trim();
        const current = needed.get(key) || {
          name:
            canonicalDisplayName ||
            rawLabel ||
            titleCaseWords(normalizeIngredientBaseName(ing.name)),
          kind,
          quantity: 0,
          displayUnit: kind === 'other' ? displayUnit : undefined,
        };

        current.quantity += delta;

        if (
          rawLabel &&
          !canonicalDisplayName &&
          (!current.name || rawLabel.length > String(current.name).length)
        ) {
          current.name = rawLabel;
        }
        if (kind === 'other' && displayUnit && !current.displayUnit) {
          current.displayUnit = displayUnit;
        }

        needed.set(key, current);
      }
    }
  }

  return needed;
}

/**
 * @param {Array<{ name: string, quantity?: number, unit?: string }>} fridgeItems
 * @returns {Map<string, number>} mergeKey → total in the same base unit as needed map
 */
function aggregateFridgeTotals(fridgeItems) {
  const fridgeMap = new Map();

  for (const f of fridgeItems || []) {
    const { key, delta } = shoppingMergeContribution(
      f.name,
      Number(f.quantity) || 0,
      f.unit
    );
    fridgeMap.set(key, (fridgeMap.get(key) || 0) + delta);
  }

  return fridgeMap;
}

module.exports = {
  aggregateNeededFromPlan,
  aggregateFridgeTotals,
};
