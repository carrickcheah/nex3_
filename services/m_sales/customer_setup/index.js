const express = require('express');
const router = express.Router();

// Import submodule routers
const billingAddressRoutes = require('./customer_billing_address/routes/billingRoutes');
const deliveryAddressRoutes = require('./customer_delivery_address/routes/deliveryRoutes');
const priceListRoutes = require('./customer_price_list/routes/price_list_Model');
// Import currencyRoutes but we'll mount it directly in the main sales index.js
// so we won't use it here to avoid path conflicts
// const currencyRoutes = require('./customer_currency_setup/routes/currencyRoutes');

// Dashboard route
router.get('/', (req, res) => {
  res.render('m_sales/customer_setup/customer_dashboard', {
    pageTitle: 'Customer Setup Dashboard',
    title: 'Sales',
    user: req.session.user || {}
  });
});

// Alternative route
router.get('/customer_dashboard', (req, res) => {
  res.render('m_sales/customer_setup/customer_dashboard', {
    pageTitle: 'Customer Dashboard',
    title: 'Sales',
    user: req.session.user || {}
  });
});

// Mount billing address routes - these should use relative paths
router.use('/', billingAddressRoutes);

// Mount delivery address routes
router.use('/', deliveryAddressRoutes);

// Mount price list routes
router.use('/', priceListRoutes);

// We've removed mounting the currency routes here since they use
// absolute paths and are now mounted directly in the main sales index.js

module.exports = router;
