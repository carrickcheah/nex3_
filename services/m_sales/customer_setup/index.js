const express = require('express');
const router = express.Router();

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

module.exports = router;
