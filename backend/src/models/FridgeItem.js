const mongoose = require('mongoose');

const fridgeItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, lowercase: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'buc' },
    category: { type: String, default: 'other' },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

fridgeItemSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('FridgeItem', fridgeItemSchema);
