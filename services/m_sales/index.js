const express = require('express');
const router = express.Router();

// Sales landing page route
router.get('/page/sales', (req, res) => {
  res.render('m_sales/sales_landing', { 
    title: 'Sales'
  });
});

module.exports = {
  salesRoutes: router
}; 