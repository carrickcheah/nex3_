const express = require('express');
const router = express.Router();

// Import submodule routers (we'll implement these later as needed)
// const generalSetupRoutes = require('./customer_general_setup/routes/generalSetupRoutes');
// const billingAddressRoutes = require('./customer_billing_address/routes/billingAddressRoutes');
// const contactSetupRoutes = require('./customer_contact_setup/routes/contactRoutes');
// const currencySetupRoutes = require('./customer_currency_setup/routes/currencyRoutes');
// const deliveryAddressRoutes = require('./customer_delivery_address/routes/deliveryAddressRoutes');
// const priceListRoutes = require('./customer_price_list/routes/priceListRoutes');

// Customer Setup landing page route
router.get('/page/sales/customer_setup', (req, res) => {
  res.render('m_sales/Customer Setup/customer_dashboard', { 
    pageTitle: 'Customer Setup',
    title: 'Customer Setup',
    user: req.session.user || {}
  });
});

// Customer General Setup route
router.get('/page/sales/customer_general_setup', (req, res) => {
  res.render('m_sales/Customer Setup/customer_general_setup/general_setup', { 
    pageTitle: 'Customer General Setup',
    title: 'Customer General Setup',
    user: req.session.user || {}
  });
});

// Customer Billing Address Setup route
router.get('/page/sales/customer_billing_address', (req, res) => {
  res.render('m_sales/Customer Setup/customer_billing_address/billing_address', { 
    pageTitle: 'Customer Billing Address Setup',
    title: 'Customer Billing Address Setup',
    user: req.session.user || {}
  });
});

// Customer Contact Setup route
router.get('/page/sales/customer_contact_setup', (req, res) => {
  res.render('m_sales/Customer Setup/customer_contact_setup/contact_setup', { 
    pageTitle: 'Customer Contact Setup',
    title: 'Customer Contact Setup',
    user: req.session.user || {}
  });
});

// Customer Currency Setup route
router.get('/page/sales/customer_currency_setup', (req, res) => {
  res.render('m_sales/Customer Setup/customer_currency_setup/currency_setup', { 
    pageTitle: 'Customer Currency Setup',
    title: 'Customer Currency Setup',
    user: req.session.user || {}
  });
});

// Customer Delivery Address Setup route
router.get('/page/sales/customer_delivery_address', (req, res) => {
  res.render('m_sales/Customer Setup/customer_delivery_address/delivery_address', { 
    pageTitle: 'Customer Delivery Address Setup',
    title: 'Customer Delivery Address Setup',
    user: req.session.user || {}
  });
});

// Customer Price List Setup route
router.get('/page/sales/customer_price_list', (req, res) => {
  res.render('m_sales/Customer Setup/customer_price_list/price_list', { 
    pageTitle: 'Customer Price List Setup',
    title: 'Customer Price List Setup',
    user: req.session.user || {}
  });
});

// Register submodule routes when they're implemented
// router.use('/', generalSetupRoutes);
// router.use('/', billingAddressRoutes);
// router.use('/', contactSetupRoutes);
// router.use('/', currencySetupRoutes);
// router.use('/', deliveryAddressRoutes);
// router.use('/', priceListRoutes);

module.exports = {
  customerSetupRoutes: router
};
