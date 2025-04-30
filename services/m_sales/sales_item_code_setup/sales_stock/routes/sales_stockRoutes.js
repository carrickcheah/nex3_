const express = require('express');
const router = express.Router();
const salesStockController = require('../controllers/sales_stockController');
const SalesStockModel = require('../models/sales_stockModel'); // Required for fetching data for views

// --- Web Page Routes ---

// Main stock code setup page (Table View)
router.get('/', (req, res) => {
    res.render('m_sales/sales_item_code_setup/sales_stock/tableview_sales_stock', {
        pageTitle: 'Sales Stock Code Setup',
        title: 'Sales',
        user: req.session.user || {}
    });
});

// Add new stock code page
router.get('/add', (req, res) => {
    res.render('m_sales/sales_item_code_setup/sales_stock/add_sales_stock', {
        pageTitle: 'Add Sales Stock Code',
        title: 'Sales',
        user: req.session.user || {},
        stockCode: null, // Pass null for add mode
        formMode: 'add'
    });
});

// Edit stock code page - Fetches data first
router.get('/edit/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const stockCode = await SalesStockModel.getById(id);
        if (!stockCode) {
            // Handle case where stock code is not found
            return res.status(404).render('error', { message: 'Stock code not found' }); 
        }
        res.render('m_sales/sales_item_code_setup/sales_stock/add_sales_stock', { // Reuse add form for edit
            pageTitle: 'Edit Sales Stock Code',
            title: 'Sales',
            user: req.session.user || {},
            stockCode: stockCode, // Pass existing data
            formMode: 'edit'
        });
    } catch (error) {
        console.error('Error fetching stock code for edit:', error);
        res.status(500).render('error', { message: 'Failed to load edit page' });
    }
});

// View stock code details page - Fetches data first
router.get('/view/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const stockCode = await SalesStockModel.getById(id);
        if (!stockCode) {
            // Handle case where stock code is not found
            return res.status(404).render('error', { message: 'Stock code not found' }); 
        }
        res.render('m_sales/sales_item_code_setup/sales_stock/view_sales_stock', {
            pageTitle: 'View Sales Stock Code',
            title: 'Sales',
            user: req.session.user || {},
            stockCode: stockCode // Pass fetched data to the view
        });
    } catch (error) {
        console.error('Error fetching stock code for view:', error);
        res.status(500).render('error', { message: 'Failed to load view page' });
    }
});

// --- API Routes ---

// GET all stock codes (for table view AJAX)
router.get('/api/sales/stock-codes', salesStockController.getAllStockCodes);

// GET single stock code by ID (useful for fetching data for edit form)
router.get('/api/sales/stock-codes/:id', salesStockController.getStockCodeById);

// POST a new stock code
router.post('/api/sales/stock-codes', salesStockController.createStockCode);

// PUT (update) an existing stock code by ID
router.put('/api/sales/stock-codes/:id', salesStockController.updateStockCode);

// DELETE a stock code by ID (soft delete)
router.delete('/api/sales/stock-codes/:id', salesStockController.deleteStockCode);

module.exports = router;