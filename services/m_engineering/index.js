const express = require('express');
const router = express.Router();

// Engineering landing page route
router.get('/page/engineering', (req, res) => {
  res.render('m_engineering/engineering', { 
    title: 'Engineering'
  });
});

module.exports = {
  engineeringRoutes: router
}; 