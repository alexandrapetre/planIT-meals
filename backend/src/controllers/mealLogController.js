const asyncHandler = require('express-async-handler');
const MealLog = require('../models/MealLog');
const Recipe = require('../models/Recipe');

function normalizeDate(value) {
  if (!value) {
    return formatLocalDateKey(new Date());
  }
  const s = String(value).slice(0, 10);
  // YYYY-MM-DD from client is already a calendar day — do not pass through UTC ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return s;
  return formatLocalDateKey(d);
}

function formatLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// GET /api/meal-logs?date=YYYY-MM-DD
const getMealLogs = asyncHandler(async (req, res) => {
  const date = normalizeDate(req.query.date);
  const logs = await MealLog.find({ user: req.user._id, date })
    .sort({ createdAt: 1 })
    .populate('recipe', 'title imageUrl calories');

  const totals = logs.reduce(
    (acc, log) => {
      acc.calories += log.calories || 0;
      acc.protein += log.protein || 0;
      acc.fat += log.fat || 0;
      acc.carbs += log.carbs || 0;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  res.json({ date, items: logs, totals });
});

// POST /api/meal-logs
const createMealLog = asyncHandler(async (req, res) => {
  const {
    date,
    mealType,
    recipe,
    name,
    imageUrl,
    servingGrams,
    calories,
    protein,
    fat,
    carbs,
    notes,
  } = req.body;

  if (!mealType) {
    res.status(400);
    throw new Error('mealType is required.');
  }

  let finalName = (name || '').trim();
  let finalImage = imageUrl || '';
  let finalCalories = num(calories);
  let finalProtein = num(protein);
  let finalFat = num(fat);
  let finalCarbs = num(carbs);
  let finalRecipe;

  if (recipe) {
    const recipeDoc = await Recipe.findById(recipe);
    if (!recipeDoc) {
      res.status(404);
      throw new Error('Recipe not found.');
    }
    finalRecipe = recipeDoc._id;
    if (!finalName) finalName = recipeDoc.title;
    if (!finalImage) finalImage = recipeDoc.imageUrl || '';
    if (!calories && recipeDoc.calories) finalCalories = recipeDoc.calories;
  }

  if (!finalName) {
    res.status(400);
    throw new Error('name is required.');
  }

  const log = await MealLog.create({
    user: req.user._id,
    date: normalizeDate(date),
    mealType,
    recipe: finalRecipe,
    name: finalName,
    imageUrl: finalImage,
    servingGrams: num(servingGrams),
    calories: finalCalories,
    protein: finalProtein,
    fat: finalFat,
    carbs: finalCarbs,
    notes: notes || '',
  });

  const populated = await log.populate('recipe', 'title imageUrl calories');
  res.status(201).json(populated);
});

// PUT /api/meal-logs/:id
const updateMealLog = asyncHandler(async (req, res) => {
  const log = await MealLog.findById(req.params.id);
  if (!log || log.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Meal log not found.');
  }
  const fields = [
    'mealType',
    'name',
    'imageUrl',
    'servingGrams',
    'calories',
    'protein',
    'fat',
    'carbs',
    'notes',
  ];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      log[field] =
        field === 'servingGrams' ||
        field === 'calories' ||
        field === 'protein' ||
        field === 'fat' ||
        field === 'carbs'
          ? num(req.body[field])
          : req.body[field];
    }
  }
  if (req.body.date) log.date = normalizeDate(req.body.date);
  const updated = await log.save();
  await updated.populate('recipe', 'title imageUrl calories');
  res.json(updated);
});

// DELETE /api/meal-logs/:id
const deleteMealLog = asyncHandler(async (req, res) => {
  const log = await MealLog.findById(req.params.id);
  if (!log || log.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Meal log not found.');
  }
  await log.deleteOne();
  res.json({ message: 'Meal log deleted.' });
});

module.exports = {
  getMealLogs,
  createMealLog,
  updateMealLog,
  deleteMealLog,
};
