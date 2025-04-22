const express = require('express');
const router = express.Router();
const orderRoutes = require('./sales_order/routes/orderRoutes');
const instructionRoutes = require('./delivery_instruction/routes/instructionRoutes');
const deliveryOrderRoutes = require('./delivery_order/routes/delivery_orderRoutes');
const invoicesRoutes = require('./sales_invoices/routes/invoicesRoutes');
const salesReturnRoutes = require('./sales_return/routes/returnRoutes');
const replacementRoutes = require('./sales_replacement/routes/replacementRoutes');

// Sales landing page route
router.get('/page/sales', (req, res) => {
  res.render('m_sales/sales_landing', { 
    title: 'Sales',
    user: req.session.user || {}
  });
});

// Add redirect for sales returns
router.get('/page/sales/returns', (req, res) => {
  res.redirect('/page/sales/sreturn_inquiry');
});

// Add redirect for sales replacements/claims
router.get('/page/sales/sclaim_inquiry', (req, res) => {
  res.redirect('/page/sales/sales_replacement');
});

// Add redirect for sales replacements
router.get('/page/sales/replacements', (req, res) => {
  res.redirect('/page/sales/sales_replacement');
});

// Register order routes
router.use('/', orderRoutes);

// Register delivery instruction routes
router.use('/', instructionRoutes);

// Register delivery order routes
router.use('/', deliveryOrderRoutes);

// Register invoices routes
router.use('/', invoicesRoutes);

// Register sales return routes
router.use('/', salesReturnRoutes);

// Register sales replacement routes
router.use('/', replacementRoutes);

module.exports = {
  salesRoutes: router
}; 