const express = require('express');
const router = express.Router();
const orderRoutes = require('./sales_order/routes/orderRoutes');
const instructionRoutes = require('./delivery_instruction/routes/instructionRoutes');
const deliveryOrderRoutes = require('./delivery_order/routes/delivery_orderRoutes');
const invoicesRoutes = require('./sales_invoices/routes/invoicesRoutes');

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

// Register delivery order routes
router.use('/', deliveryOrderRoutes);

// Register invoices routes
router.use('/', invoicesRoutes);

module.exports = {
  salesRoutes: router
}; 