const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    unit: { type: String, default: 'g' },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fats: { type: Number, default: 0 },
    category: { type: String, default: 'other' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ingredient', ingredientSchema);
