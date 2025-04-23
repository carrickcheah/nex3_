const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Web Routes - Render views
router.get('/page/sales/customer/general', customerController.renderCustomersPage);
router.get('/page/sales/customer/general/add', customerController.renderAddCustomerPage);
router.get('/page/sales/customer/general/edit/:id', customerController.renderEditCustomerPage);
router.get('/page/sales/customer/general/view/:id', customerController.renderViewCustomerPage);

// API Routes - Return JSON
router.get('/api/sales/customer/general', customerController.getCustomers);
router.get('/api/sales/customer/general/:id', customerController.getCustomer);
router.post('/api/sales/customer/general', customerController.createCustomer);
router.put('/api/sales/customer/general/:id', customerController.updateCustomer);
router.delete('/api/sales/customer/general/:id', customerController.deleteCustomer);
router.get('/api/sales/customer/general/check/:code', customerController.checkCustomerCode);

module.exports = router; 