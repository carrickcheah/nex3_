const billingModel = require('../models/billingModel');

/**
 * Render the billing address table view page
 */
exports.renderTableView = async (req, res) => {
    try {
        res.render('m_sales/Customer Setup/customer_billing_address/table_view_billing_address', {
            pageTitle: 'Customer Billing Address'
        });
    } catch (error) {
        console.error('Error rendering billing address table view:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

/**
 * Render the add billing address page
 */
exports.renderAddForm = async (req, res) => {
    try {
        // Get countries for dropdown
        const countries = await billingModel.getCountries();
        
        res.render('m_sales/Customer Setup/customer_billing_address/add_billing_address', {
            pageTitle: 'Add Billing Address',
            countries: countries
        });
    } catch (error) {
        console.error('Error rendering add billing address form:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

/**
 * Render the edit billing address page
 */
exports.renderEditForm = async (req, res) => {
    try {
        const billingId = req.params.id;
        
        // Get billing address details
        const address = await billingModel.getBillingAddressById(billingId);
        
        if (!address) {
            return res.status(404).send('Billing address not found');
        }
        
        // Get countries for dropdown
        const countries = await billingModel.getCountries();
        
        res.render('m_sales/Customer Setup/customer_billing_address/edit_billing_address', {
            pageTitle: 'Edit Billing Address',
            address: address,
            countries: countries
        });
    } catch (error) {
        console.error('Error rendering edit billing address form:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

/**
 * Render the view billing address page
 */
exports.renderViewPage = async (req, res) => {
    try {
        const billingId = req.params.id;
        
        // Get billing address details
        const address = await billingModel.getBillingAddressById(billingId);
        
        if (!address) {
            return res.status(404).send('Billing address not found');
        }
        
        res.render('m_sales/Customer Setup/customer_billing_address/view_billing_address', {
            pageTitle: 'Billing Address Details',
            address: address
        });
    } catch (error) {
        console.error('Error rendering view billing address page:', error);
        res.status(500).send('An error occurred while loading the page');
    }
};

// API ENDPOINTS

/**
 * API endpoint to get billing addresses with pagination, search, and sorting
 */
exports.getBillingAddresses = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const sortField = req.query.sortField || 'customer';
        const sortOrder = req.query.sortOrder || 'asc';
        
        const result = await billingModel.getBillingAddresses(page, limit, search, sortField, sortOrder);
        
        res.json({
            success: true,
            data: result.addresses,
            pagination: {
                page: page,
                limit: limit,
                total: result.total,
                pages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting billing addresses:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching billing addresses'
        });
    }
};

/**
 * API endpoint to get a billing address by ID
 */
exports.getBillingAddressById = async (req, res) => {
    try {
        const billingId = req.params.id;
        const address = await billingModel.getBillingAddressById(billingId);
        
        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Billing address not found'
            });
        }
        
        res.json({
            success: true,
            data: address
        });
    } catch (error) {
        console.error('Error getting billing address:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching the billing address'
        });
    }
};

/**
 * API endpoint to create a new billing address
 */
exports.createBillingAddress = async (req, res) => {
    try {
        const addressData = req.body;
        
        // Validate required fields
        if (!addressData.customer_id || !addressData.location_name) {
            return res.status(400).json({
                success: false,
                message: 'Customer and location name are required'
            });
        }
        
        const result = await billingModel.createBillingAddress(addressData);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Billing address created successfully',
            billingId: result.billingId
        });
    } catch (error) {
        console.error('Error creating billing address:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while creating the billing address'
        });
    }
};

/**
 * API endpoint to update a billing address
 */
exports.updateBillingAddress = async (req, res) => {
    try {
        const billingId = req.params.id;
        const addressData = req.body;
        
        // Validate required fields
        if (!addressData.customer_id || !addressData.location_name) {
            return res.status(400).json({
                success: false,
                message: 'Customer and location name are required'
            });
        }
        
        // Check if billing address exists
        const existingAddress = await billingModel.getBillingAddressById(billingId);
        
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: 'Billing address not found'
            });
        }
        
        const result = await billingModel.updateBillingAddress(billingId, addressData);
        
        res.json({
            success: true,
            message: 'Billing address updated successfully',
            affectedRows: result.affectedRows
        });
    } catch (error) {
        console.error('Error updating billing address:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the billing address'
        });
    }
};

/**
 * API endpoint to delete a billing address
 */
exports.deleteBillingAddress = async (req, res) => {
    try {
        const billingId = req.params.id;
        
        // Check if billing address exists
        const existingAddress = await billingModel.getBillingAddressById(billingId);
        
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: 'Billing address not found'
            });
        }
        
        await billingModel.deleteBillingAddress(billingId);
        
        res.json({
            success: true,
            message: 'Billing address deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting billing address:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the billing address'
        });
    }
};