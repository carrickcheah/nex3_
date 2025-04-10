const express = require('express');
const router = express.Router();
const dailyOutputController = require('../controllers/dailyOutputController');

// GET routes for daily output
router.get('/page/manufacture/daily_output', (req, res) => {
  res.redirect('/page/manufacture/daily_inquiry');
});
router.get('/page/manufacture/daily_output/new', dailyOutputController.dailyOutputNew);
router.get('/page/manufacture/daily_output/edit/:id', dailyOutputController.dailyOutputEdit);
router.get('/page/manufacture/daily_output/view/:id', dailyOutputController.dailyOutputView);
router.get('/page/manufacture/daily_inquiry', dailyOutputController.dailyOutputInquiry);
router.get('/page/daily-output/inquiry', dailyOutputController.dailyOutputInquiry);
router.get('/page/daily-output/inquiry/sample', dailyOutputController.generateSampleData);

// POST routes for daily output
router.post('/page/manufacture/daily_output/create', dailyOutputController.createDailyOutput);
router.post('/page/manufacture/daily_output/update/:id', dailyOutputController.updateDailyOutput);

module.exports = router;
