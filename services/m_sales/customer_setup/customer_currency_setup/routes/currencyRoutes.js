const express = require('express');
const router = express.Router();
const currencyController = require('../controllers/currencyController');

// Redirect route for the URL the user is trying to access
router.get('/page/sales/customer_currency_setup', (req, res) => {
    res.redirect('/page/sales/currency-setup');
});

// Page routes
router.get('/page/sales/currency-setup', currencyController.renderTableView);
router.get('/page/sales/currency-setup/add', currencyController.renderAddForm);
router.get('/page/sales/currency-setup/edit/:id', currencyController.renderEditForm);
router.get('/page/sales/currency-setup/view/:id', currencyController.renderViewPage);

// API routes
router.get('/api/sales/currency-setup', currencyController.getCustomerCurrencies);
router.get('/api/sales/currency-setup/:id', currencyController.getCustomerCurrencyById);
router.post('/api/sales/currency-setup', currencyController.createCustomerCurrency);
router.put('/api/sales/currency-setup/:id', currencyController.updateCustomerCurrency);
router.delete('/api/sales/currency-setup/:id', currencyController.deleteCustomerCurrency);
router.get('/api/sales/currencies', currencyController.getCurrencies);
router.get('/api/sales/currency-customers', currencyController.getCustomers);

module.exports = router;
