const express = require('express');
const router = express.Router();
const orderRoutes = require('./sales_order/routes/orderRoutes');
const instructionRoutes = require('./delivery_instruction/routes/instructionRoutes');

// Sales landing page route
router.get('/page/sales', (req, res) => {
  res.render('m_sales/sales_landing', { 
    title: 'Sales'
  });
});

// Register order routes
router.use('/', orderRoutes);

// Register delivery instruction routes
router.use('/', instructionRoutes);

module.exports = {
  salesRoutes: router
}; 