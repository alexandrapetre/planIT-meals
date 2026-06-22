const asyncHandler = require('express-async-handler');
const MealPlan = require('../models/MealPlan');
const Recipe = require('../models/Recipe');
const FridgeItem = require('../models/FridgeItem');
const MealLog = require('../models/MealLog');
const { generatePlanDays } = require('../services/aiPlanner');
const { formatQuantityForApi } = require('../utils/ingredientShoppingKey');
const {
  aggregateNeededFromPlan,
  aggregateFridgeTotals,
} = require('../utils/aggregateShoppingMap');

// GET /api/meal-plans
const getMealPlans = asyncHandler(async (req, res) => {
  const plans = await MealPlan.find({ user: req.user._id })
    .sort({ startDate: -1 })
    .populate('days.meals.recipe', 'title calories servings imageUrl category');
  res.json(plans);
});

// GET /api/meal-plans/:id
const getMealPlanById = asyncHandler(async (req, res) => {
  const plan = await MealPlan.findById(req.params.id).populate(
    'days.meals.recipe'
  );
  if (!plan || plan.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Meal plan not found.');
  }
  res.json(plan);
});

// POST /api/meal-plans
const createMealPlan = asyncHandler(async (req, res) => {
  const { name, startDate, endDate, days } = req.body;
  if (!startDate || !endDate) {
    res.status(400);
    throw new Error('Start and end dates are required.');
  }
  const plan = await MealPlan.create({
    user: req.user._id,
    name,
    startDate,
    endDate,
    days: days || [],
  });
  res.status(201).json(plan);
});

// POST /api/meal-plans/generate
// Uses the local AI planner (see services/aiPlanner.js) which personalizes
// the selection based on: dietary restrictions, allergies, recent tracking
// history, variety across cuisines/categories, prep+cook time fit for the
// weekday/weekend, and overlap with items already in My Fridge.
const generateMealPlan = asyncHandler(async (req, res) => {
  const { startDate, days = 7 } = req.body;
  const start = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(start.getTime())) {
    res.status(400);
    throw new Error('Invalid startDate.');
  }
  const plannerDays = Math.max(1, Math.min(30, Number(days) || 7));

  const recipes = await Recipe.find({
    calories: { $gt: 0 },
    servings: { $gt: 0 },
  }).select('_id title category area tags calories servings prepTime cookTime ingredients');

  // pull last 14 days of tracking to avoid meals the user already ate
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const recentLogs = await MealLog.find({
    user: req.user._id,
    createdAt: { $gte: fourteenDaysAgo },
    recipe: { $ne: null },
  }).select('recipe');
  const recentLogIds = recentLogs
    .map((log) => log.recipe)
    .filter(Boolean);

  const fridgeItems = await FridgeItem.find({ user: req.user._id }).select(
    'name'
  );

  const result = generatePlanDays({
    user: req.user,
    recipes,
    fridgeItems,
    recentLogIds,
    startDate: start,
    days: plannerDays,
  });

  if (result.error) {
    res.status(400);
    throw new Error(result.error);
  }

  const end = new Date(start);
  end.setDate(start.getDate() + plannerDays - 1);

  const plan = await MealPlan.create({
    user: req.user._id,
    name: `Plan ${start.toISOString().slice(0, 10)}`,
    startDate: start,
    endDate: end,
    days: result.days,
  });

  const populated = await plan.populate({
    path: 'days.meals.recipe',
    select: 'title calories servings imageUrl category area',
  });
  const payload = populated.toObject();
  payload.shoppingListSize = result.shoppingSize;
  res.status(201).json(payload);
});

// PUT /api/meal-plans/:id
const updateMealPlan = asyncHandler(async (req, res) => {
  const plan = await MealPlan.findById(req.params.id);
  if (!plan || plan.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Meal plan not found.');
  }
  Object.assign(plan, req.body);
  const updated = await plan.save();
  res.json(updated);
});

// DELETE /api/meal-plans/:id
const deleteMealPlan = asyncHandler(async (req, res) => {
  const plan = await MealPlan.findById(req.params.id);
  if (!plan || plan.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Meal plan not found.');
  }
  await plan.deleteOne();
  res.json({ message: 'Meal plan deleted.' });
});

// GET /api/meal-plans/:id/shopping-list
// Builds one Map over the whole plan (all days × meals × ingredients), then fridge.
const getShoppingList = asyncHandler(async (req, res) => {
  const plan = await MealPlan.findById(req.params.id).populate('days.meals.recipe');
  if (!plan || plan.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Meal plan not found.');
  }

  const needed = aggregateNeededFromPlan(plan);

  const fridgeItems = await FridgeItem.find({ user: req.user._id });
  const fridgeMap = aggregateFridgeTotals(fridgeItems);

  const shoppingList = Array.from(needed.entries()).map(([mergeKey, item]) => {
    const inFridgeBase = fridgeMap.get(mergeKey) || 0;
    const missingBase = Math.max(0, item.quantity - inFridgeBase);
    const neededFmt = formatQuantityForApi(
      item.kind,
      item.quantity,
      item.displayUnit
    );
    const inFridgeFmt = formatQuantityForApi(
      item.kind,
      inFridgeBase,
      item.displayUnit
    );
    const missingFmt = formatQuantityForApi(
      item.kind,
      missingBase,
      item.displayUnit
    );
    return {
      name: item.name,
      unit: neededFmt.unit,
      needed: neededFmt.qty,
      inFridge: inFridgeFmt.qty,
      missing: missingFmt.qty,
    };
  });

  const sortByName = (a, b) =>
    String(a.name).localeCompare(String(b.name), undefined, {
      sensitivity: 'base',
    });

  shoppingList.sort(sortByName);

  res.json({
    planId: plan._id,
    planName: plan.name,
    items: shoppingList.filter((i) => i.missing > 0),
    alreadyCovered: shoppingList.filter((i) => i.missing === 0),
  });
});

module.exports = {
  getMealPlans,
  getMealPlanById,
  createMealPlan,
  generateMealPlan,
  updateMealPlan,
  deleteMealPlan,
  getShoppingList,
};
