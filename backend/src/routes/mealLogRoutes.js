const express = require('express');
const router = express.Router();
const {
  getMealLogs,
  createMealLog,
  updateMealLog,
  deleteMealLog,
} = require('../controllers/mealLogController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getMealLogs).post(createMealLog);
router.route('/:id').put(updateMealLog).delete(deleteMealLog);

module.exports = router;
