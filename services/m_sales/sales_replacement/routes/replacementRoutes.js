const express = require('express');
const router = express.Router();
const ReplacementController = require('../controllers/replacementController');

// Web Routes - HTML Pages
router.get('/page/sales/sales_replacement', ReplacementController.replacementList);
router.get('/page/sales/sales_replacement/add', ReplacementController.addReplacement);
router.get('/page/sales/sales_replacement/edit/:id', ReplacementController.editReplacement);
router.get('/page/sales/sales_replacement/view/:id', ReplacementController.viewReplacement);

// API Routes - JSON Data
router.get('/api/sales/replacements', ReplacementController.getReplacements);
router.get('/api/sales/replacements/:id', ReplacementController.getReplacementById);
router.post('/api/sales/replacements', ReplacementController.createReplacement);
router.put('/api/sales/replacements/:id', ReplacementController.updateReplacement);
router.delete('/api/sales/replacements/:id', ReplacementController.deleteReplacement);
router.get('/api/sales/replacements/docref/generate', ReplacementController.generateDocRef);
router.get('/api/sales/replacements/test/connection', ReplacementController.testConnection);

// API routes for fetching related data
router.get('/api/sales/replacements/customers', ReplacementController.getCustomers);
router.get('/api/sales/replacements/products', ReplacementController.getProducts);
router.get('/api/sales/replacements/returns', ReplacementController.getReturns);

module.exports = router;
