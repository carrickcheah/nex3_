const express = require('express');
const router = express.Router();

// Purchasing landing page route
router.get('/page/purchasing', (req, res) => {
  res.render('m_purchasing/purchasing', { 
    title: 'Purchasing'
  });
});

module.exports = {
  purchasingRoutes: router
}; 