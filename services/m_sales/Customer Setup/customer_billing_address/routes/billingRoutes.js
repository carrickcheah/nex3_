const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

// Page routes
router.get('/billing-address', billingController.renderTableView);
router.get('/billing-address/add', billingController.renderAddForm);
router.get('/billing-address/edit/:id', billingController.renderEditForm);
router.get('/billing-address/view/:id', billingController.renderViewPage);

// API routes
router.get('/api/sales/billing-address', billingController.getBillingAddresses);
router.get('/api/sales/billing-address/:id', billingController.getBillingAddressById);
router.post('/api/sales/billing-address', billingController.createBillingAddress);
router.put('/api/sales/billing-address/:id', billingController.updateBillingAddress);
router.delete('/api/sales/billing-address/:id', billingController.deleteBillingAddress);

module.exports = router;