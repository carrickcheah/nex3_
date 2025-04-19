const express = require('express');
const router = express.Router();
const InvoicesController = require('../controllers/invoicesController');

/**
 * Web Routes - Pages
 */
// Sales Invoices listing page
router.get('/page/sales/invoices', InvoicesController.invoicesList);

// Add Sales Invoice page
router.get('/page/sales/invoices/add', InvoicesController.addInvoice);

// Edit Sales Invoice page
router.get('/page/sales/invoices/edit/:id', InvoicesController.editInvoice);

// View Sales Invoice page
router.get('/page/sales/invoices/view/:id', InvoicesController.viewInvoice);

/**
 * API Routes
 */
// Get all sales invoices with pagination and filtering
router.get('/api/sales/invoices', InvoicesController.getSalesInvoices);

// Get sales invoice by ID
router.get('/api/sales/invoices/:id', InvoicesController.getSalesInvoiceById);

// Create a new sales invoice
router.post('/api/sales/invoices', InvoicesController.createSalesInvoice);

// Update an existing sales invoice
router.put('/api/sales/invoices/:id', InvoicesController.updateSalesInvoice);

// Delete a sales invoice
router.delete('/api/sales/invoices/:id', InvoicesController.deleteSalesInvoice);

// Generate a new invoice number
router.get('/api/sales/invoices/generate/number', InvoicesController.generateInvoiceNumber);

// Get customers for dropdown
router.get('/api/sales/customers', InvoicesController.getCustomers);

// Get products for dropdown
router.get('/api/sales/products', InvoicesController.getProducts);

// Test connection
router.get('/api/sales/test', InvoicesController.testConnection);

module.exports = router;
