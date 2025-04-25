const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

// Page routes - update to use full paths
router.get('/page/sales/billing-address', billingController.renderTableView);
router.get('/page/sales/billing-address/add', billingController.renderAddForm);
router.get('/page/sales/billing-address/edit/:id', billingController.renderEditForm);
router.get('/page/sales/billing-address/view/:id', billingController.renderViewPage);

// API routes
router.get('/api/sales/billing-address', billingController.getBillingAddresses);
router.get('/api/sales/billing-address/:id', billingController.getBillingAddressById);
router.post('/api/sales/billing-address', billingController.createBillingAddress);
router.put('/api/sales/billing-address/:id', billingController.updateBillingAddress);
router.delete('/api/sales/billing-address/:id', billingController.deleteBillingAddress);
router.get('/api/sales/customers', billingController.getCustomers);

module.exports = router;