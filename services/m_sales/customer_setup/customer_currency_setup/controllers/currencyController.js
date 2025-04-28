const currencyModel = require('../models/currencyModel');

/**
 * Render the currency table view page
 */
exports.renderTableView = async (req, res) => {
    try {
        res.render('m_sales/customer_setup/customer_currency_setup/table_view_currency', {
            pageTitle: 'Customer Currency Setup',
            title: 'Customer Setup',
            user: req.session.user || {}
        });
    } catch (error) {
        console.error('Error rendering currency table view:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

/**
 * Render the add currency page
 */
exports.renderAddForm = async (req, res) => {
    try {
        // Get currencies for dropdown
        const currencies = await currencyModel.getCurrencies();
        // Get customers for dropdown
        const customers = await currencyModel.getCustomers();
        
        res.render('m_sales/customer_setup/customer_currency_setup/add_currency', {
            pageTitle: 'Add Customer Currency',
            title: 'Customer Setup',
            currencies: currencies,
            customers: customers,
            user: req.session.user || {}
        });
    } catch (error) {
        console.error('Error rendering add currency form:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

/**
 * Render the edit currency page
 */
exports.renderEditForm = async (req, res) => {
    try {
        const customerId = req.params.id;
        
        // Get currency details
        const currency = await currencyModel.getCustomerCurrencyById(customerId);
        
        if (!currency) {
            return res.status(404).send('Customer currency not found');
        }
        
        // Get currencies for dropdown
        const currencies = await currencyModel.getCurrencies();
        // Get customers for dropdown
        const customers = await currencyModel.getCustomers();
        
        res.render('m_sales/customer_setup/customer_currency_setup/edit_currency', {
            pageTitle: 'Edit Customer Currency',
            title: 'Customer Setup',
            currency: currency,
            currencies: currencies,
            customers: customers,
            user: req.session.user || {}
        });
    } catch (error) {
        console.error('Error rendering edit currency form:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

/**
 * Render the view currency page
 */
exports.renderViewPage = async (req, res) => {
    try {
        const customerId = req.params.id;
        
        // Get currency details
        const currency = await currencyModel.getCustomerCurrencyById(customerId);
        
        if (!currency) {
            return res.status(404).send('Customer currency not found');
        }
        
        res.render('m_sales/customer_setup/customer_currency_setup/view_currency', {
            pageTitle: 'Currency Details',
            title: 'Customer Setup',
            currency: currency,
            user: req.session.user || {}
        });
    } catch (error) {
        console.error('Error rendering view currency page:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

// API ENDPOINTS

/**
 * API endpoint to get currencies with pagination, search, and sorting
 */
exports.getCustomerCurrencies = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const sortField = req.query.sortField || 'seq_no';
        const sortOrder = req.query.sortOrder || 'asc';
        
        const result = await currencyModel.getCustomerCurrencies(page, limit, search, sortField, sortOrder);
        
        res.json({
            success: true,
            data: result.currencies,
            pagination: {
                page: page,
                limit: limit,
                total: result.total,
                pages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting customer currencies:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching customer currencies'
        });
    }
};

/**
 * API endpoint to get a customer currency by ID
 */
exports.getCustomerCurrencyById = async (req, res) => {
    try {
        const customerId = req.params.id;
        const currency = await currencyModel.getCustomerCurrencyById(customerId);
        
        if (!currency) {
            return res.status(404).json({
                success: false,
                message: 'Customer currency not found'
            });
        }
        
        res.json({
            success: true,
            data: currency
        });
    } catch (error) {
        console.error('Error getting customer currency:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the customer currency'
        });
    }
};

/**
 * API endpoint to create a new customer currency
 */
exports.createCustomerCurrency = async (req, res) => {
    try {
        const currencyData = req.body;
        
        // Validate required fields
        if (!currencyData.customer_id || !currencyData.currency_id) {
            return res.status(400).json({
                success: false,
                message: 'Customer and currency are required'
            });
        }
        
        const result = await currencyModel.createCustomerCurrency(currencyData);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Customer currency created successfully',
            currencyId: result.currencyId
        });
    } catch (error) {
        console.error('Error creating customer currency:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating the customer currency'
        });
    }
};

/**
 * API endpoint to update a customer currency
 */
exports.updateCustomerCurrency = async (req, res) => {
    try {
        const relationId = req.params.id;
        const currencyData = req.body;
        
        // Validate required fields
        if (!currencyData.customer_id || !currencyData.currency_id) {
            return res.status(400).json({
                success: false,
                message: 'Customer and currency are required'
            });
        }
        
        const result = await currencyModel.updateCustomerCurrency(relationId, currencyData);
        
        res.json({
            success: true,
            message: 'Customer currency updated successfully',
            affectedRows: result.affectedRows
        });
    } catch (error) {
        console.error('Error updating customer currency:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the customer currency'
        });
    }
};

/**
 * API endpoint to delete a customer currency
 */
exports.deleteCustomerCurrency = async (req, res) => {
    try {
        const relationId = req.params.id;
        
        await currencyModel.deleteCustomerCurrency(relationId);
        
        res.json({
            success: true,
            message: 'Customer currency deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting customer currency:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the customer currency'
        });
    }
};

/**
 * API endpoint to get all currencies for dropdown
 */
exports.getCurrencies = async (req, res) => {
    try {
        const currencies = await currencyModel.getCurrencies();
        
        res.json({
            success: true,
            data: currencies
        });
    } catch (error) {
        console.error('Error getting currencies:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching currencies'
        });
    }
};

/**
 * API endpoint to get all customers for dropdown
 */
exports.getCustomers = async (req, res) => {
    try {
        const customers = await currencyModel.getCustomers();
        
        res.json({
            success: true,
            data: customers
        });
    } catch (error) {
        console.error('Error getting customers:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching customers'
        });
    }
};
