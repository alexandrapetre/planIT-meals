const express = require('express');
const router = express.Router();
const {
  getFridge,
  addFridgeItem,
  updateFridgeItem,
  deleteFridgeItem,
  getSuggestions,
} = require('../controllers/fridgeController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getFridge).post(addFridgeItem);
router.get('/suggestions', getSuggestions);
router.route('/:id').put(updateFridgeItem).delete(deleteFridgeItem);

module.exports = router;
