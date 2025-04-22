const express = require('express');
const router = express.Router();
const ReturnController = require('../controllers/returnController');

// Web Routes - HTML Pages
router.get('/page/sales/sreturn_inquiry', ReturnController.returnList);
router.get('/page/sales/sreturn_inquiry/add', ReturnController.addReturn);
router.get('/page/sales/sreturn_inquiry/edit/:id', ReturnController.editReturn);
router.get('/page/sales/sreturn_inquiry/view/:id', ReturnController.viewReturn);

// API Routes - JSON Data
router.get('/api/sales/returns', ReturnController.getReturns);
router.get('/api/sales/returns/:id', ReturnController.getReturnById);
router.post('/api/sales/returns', ReturnController.createReturn);
router.put('/api/sales/returns/:id', ReturnController.updateReturn);
router.delete('/api/sales/returns/:id', ReturnController.deleteReturn);
router.get('/api/sales/returns/docref/generate', ReturnController.generateDocRef);
router.get('/api/sales/returns/test/connection', ReturnController.testConnection);

// API routes for fetching related data
router.get('/api/sales/returns/customers', ReturnController.getCustomers);
router.get('/api/sales/returns/products', ReturnController.getProducts);
router.get('/api/sales/returns/invoices', ReturnController.getInvoices);
router.get('/api/sales/returns/deliveries', ReturnController.getDeliveries);

module.exports = router;
