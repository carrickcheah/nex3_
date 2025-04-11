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
router.get('/page/daily-output/export-csv', dailyOutputController.exportToCsv);
router.get('/page/daily-output/inquiry/json', async (req, res) => {
  try {
    // Simple test route to check data
    const filters = {};
    const { page = 1, limit = 20 } = req.query;
    const result = await dailyOutputController.getDailyOutputData(filters, { page, limit });
    
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page
    });
  } catch (error) {
    console.error('JSON test route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST routes for daily output
router.post('/page/manufacture/daily_output/create', dailyOutputController.createDailyOutput);
router.post('/page/manufacture/daily_output/update/:id', dailyOutputController.updateDailyOutput);

module.exports = router;