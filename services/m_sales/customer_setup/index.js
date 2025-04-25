const express = require('express');
const router = express.Router();

// Import submodule routers
const billingAddressRoutes = require('./customer_billing_address/routes/billingRoutes');

// Root route for customer setup dashboard
router.get('/', (req, res) => {
  res.render('m_sales/customer_setup/customer_dashboard', {
    pageTitle: 'Customer Setup',
    title: 'Customer Setup',
    user: req.session.user || {}
  });
});

// Example route for customer dashboard
router.get('/customer_dashboard', (req, res) => {
  res.render('m_sales/customer_setup/customer_dashboard', {
    pageTitle: 'Customer Setup',
    title: 'Customer Setup',
    user: req.session.user || {}
  });
});

// Mount billing address routes
router.use('/', billingAddressRoutes);

module.exports = router;
