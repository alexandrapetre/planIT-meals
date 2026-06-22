const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: String, required: true, index: true },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
      index: true,
    },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '' },
    servingGrams: { type: Number, default: 0, min: 0 },
    calories: { type: Number, default: 0, min: 0 },
    protein: { type: Number, default: 0, min: 0 },
    fat: { type: Number, default: 0, min: 0 },
    carbs: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

mealLogSchema.index({ user: 1, date: 1, mealType: 1 });

module.exports = mongoose.model('MealLog', mealLogSchema);
