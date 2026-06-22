const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    meals: [mealSchema],
  },
  { _id: false }
);

const mealPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'Plan alimentar' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: [daySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('MealPlan', mealPlanSchema);
