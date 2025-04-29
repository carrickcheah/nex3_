const express = require('express');
const router = express.Router();
const orderRoutes = require('./sales_order/routes/orderRoutes');
const instructionRoutes = require('./delivery_instruction/routes/instructionRoutes');
const deliveryOrderRoutes = require('./delivery_order/routes/delivery_orderRoutes');
const invoicesRoutes = require('./sales_invoices/routes/invoicesRoutes');
const salesReturnRoutes = require('./sales_return/routes/returnRoutes');
const replacementRoutes = require('./sales_replacement/routes/replacementRoutes');
const customerSetupRoutes = require('./customer_setup');
const customerRoutes = require('./customer_setup/customer_general_setup/routes/customerRoutes');
const contactRoutes = require('./customer_setup/customer_contact_setup/routes/contactRoutes');
const billingRoutes = require('./customer_setup/customer_billing_address/routes/billingRoutes');
const currencyRoutes = require('./customer_setup/customer_currency_setup/routes/currencyRoutes');
const deliveryAddressRoutes = require('./customer_setup/customer_delivery_address/routes/deliveryRoutes');
const priceListRoutes = require('./customer_setup/customer_price_list/routes/price_list_Model');

// Sales landing page route
router.get('/page/sales', (req, res) => {
  res.render('m_sales/sales_landing', { 
    pageTitle: 'Sales',
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

// Register customer setup routes
router.use('/page/sales/customer_setup', customerSetupRoutes);

// Mount price list routes
router.use('/', priceListRoutes);

// Mount billing address API routes
router.use('/', billingRoutes);

// Mount customer routes
router.use('/', customerRoutes);
router.use('/page/sales/customer_contact_setup', contactRoutes);

// Mount currency routes
router.use('/', currencyRoutes);

// Mount delivery address routes
router.use('/', deliveryAddressRoutes);

// Add routes for customer general setup and billing address
router.get('/page/sales/customer_general_setup', (req, res) => {
  res.redirect('/page/sales/customer/general');
});

router.get('/page/sales/customer_billing_address', (req, res) => {
  res.redirect('/page/sales/billing-address');
});

// Add redirect for customer delivery address
router.get('/page/sales/customer_delivery_address', (req, res) => {
  res.redirect('/page/sales/delivery-address');
});

module.exports = {
  salesRoutes: router
}; 