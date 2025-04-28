const DeliveryModel = require('../models/deliveryModel');

/**
 * Render the delivery addresses table view page
 */
exports.renderDeliveryAddressesPage = async (req, res) => {
    try {
        res.render('m_sales/customer_setup/customer_delivery_address/table_view_delivery', {
            pageTitle: 'Customer Delivery Addresses',
            title: 'Sales',
            user: req.session.user || {}
        });
    } catch (error) {
        console.error('Error rendering delivery addresses page:', error);
        res.status(500).render('error', { 
            error: 'Failed to load delivery addresses page',
            title: 'Error'
        });
    }
};

/**
 * Render the add delivery address page
 */
exports.renderAddDeliveryAddressPage = async (req, res) => {
    try {
        const countries = await DeliveryModel.getCountries();
        const customers = await DeliveryModel.getCustomers();
        
        res.render('m_sales/customer_setup/customer_delivery_address/add_delivery', {
            pageTitle: 'Add Delivery Address',
            title: 'Sales',
            user: req.session.user || {},
            countries,
            customers
        });
    } catch (error) {
        console.error('Error rendering add delivery address page:', error);
        res.status(500).render('error', { 
            error: 'Failed to load add delivery address page',
            title: 'Error'
        });
    }
};

/**
 * Render the edit delivery address page
 */
exports.renderEditDeliveryAddressPage = async (req, res) => {
    try {
        const deliveryAddressId = req.params.id;
        const deliveryAddress = await DeliveryModel.getDeliveryAddressById(deliveryAddressId);
        
        if (!deliveryAddress) {
            return res.status(404).render('error', { 
                error: 'Delivery address not found',
                title: 'Error'
            });
        }
        
        const countries = await DeliveryModel.getCountries();
        const customers = await DeliveryModel.getCustomers();
        
        res.render('m_sales/customer_setup/customer_delivery_address/edit_delivery', {
            pageTitle: 'Edit Delivery Address',
            title: 'Sales',
            user: req.session.user || {},
            deliveryAddress,
            countries,
            customers
        });
    } catch (error) {
        console.error('Error rendering edit delivery address page:', error);
        res.status(500).render('error', { 
            error: 'Failed to load edit delivery address page',
            title: 'Error'
        });
    }
};

/**
 * Render the view delivery address page
 */
exports.renderViewDeliveryAddressPage = async (req, res) => {
    try {
        const deliveryAddressId = req.params.id;
        const deliveryAddress = await DeliveryModel.getDeliveryAddressById(deliveryAddressId);
        
        if (!deliveryAddress) {
            return res.status(404).render('error', { 
                error: 'Delivery address not found',
                title: 'Error'
            });
        }
        
        res.render('m_sales/customer_setup/customer_delivery_address/view_delivery', {
            pageTitle: 'View Delivery Address',
            title: 'Sales',
            user: req.session.user || {},
            deliveryAddress
        });
    } catch (error) {
        console.error('Error rendering view delivery address page:', error);
        res.status(500).render('error', { 
            error: 'Failed to load view delivery address page',
            title: 'Error'
        });
    }
};

/**
 * API: Get all delivery addresses with pagination and search
 */
exports.getDeliveryAddresses = async (req, res) => {
    try {
        // Process DataTables parameters
        const { 
            draw = 1, 
            start = 0, 
            length = 10, 
            'search[value]': search = '',
            'order[0][column]': orderColumn = 0,
            'order[0][dir]': orderDir = 'asc'
        } = req.query;
        
        const result = await DeliveryModel.getDeliveryAddresses({
            start: parseInt(start),
            length: parseInt(length),
            search,
            orderColumn: parseInt(orderColumn),
            orderDir
        });
        
        // Format response for DataTables
        res.json({
            success: true,
            draw: parseInt(draw),
            recordsTotal: result.total,
            recordsFiltered: result.filtered,
            pagination: {
                total: result.total
            },
            data: result.deliveryAddresses
        });
    } catch (error) {
        console.error('Error fetching delivery addresses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery addresses',
            error: error.message
        });
    }
};

/**
 * API: Get delivery address by ID
 */
exports.getDeliveryAddressById = async (req, res) => {
    try {
        const deliveryAddressId = req.params.id;
        const deliveryAddress = await DeliveryModel.getDeliveryAddressById(deliveryAddressId);
        
        if (!deliveryAddress) {
            return res.status(404).json({
                success: false,
                message: 'Delivery address not found'
            });
        }
        
        res.json({
            success: true,
            data: deliveryAddress
        });
    } catch (error) {
        console.error('Error fetching delivery address:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery address',
            error: error.message
        });
    }
};

/**
 * API: Create a new delivery address
 */
exports.createDeliveryAddress = async (req, res) => {
    try {
        const deliveryAddressData = req.body;
        const userId = req.session.user?.user_id || 1;
        
        // Add user ID from session
        deliveryAddressData.created_by = userId;
        
        // Check if this is being set as the default address
        if (parseInt(deliveryAddressData.is_default) === 1) {
            // Reset any existing default addresses for this customer
            await DeliveryModel.resetDefaultDeliveryAddresses(deliveryAddressData.customer_id);
        }
        
        // Create the delivery address
        const result = await DeliveryModel.createDeliveryAddress(deliveryAddressData);
        
        res.json({
            success: true,
            message: 'Delivery address created successfully',
            data: {
                delivery_address_id: result.insertId
            }
        });
    } catch (error) {
        console.error('Error creating delivery address:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create delivery address',
            error: error.message
        });
    }
};

/**
 * API: Update a delivery address
 */
exports.updateDeliveryAddress = async (req, res) => {
    try {
        const deliveryAddressId = req.params.id;
        const deliveryAddressData = req.body;
        const userId = req.session.user?.user_id || 1;
        
        // Add user ID from session
        deliveryAddressData.modified_by = userId;
        
        // Check if delivery address exists
        const existingAddress = await DeliveryModel.getDeliveryAddressById(deliveryAddressId);
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: 'Delivery address not found'
            });
        }
        
        // Check if this is being set as the default address
        if (parseInt(deliveryAddressData.is_default) === 1) {
            // Reset any existing default addresses for this customer
            await DeliveryModel.resetDefaultDeliveryAddresses(deliveryAddressData.customer_id);
        }
        
        // Update the delivery address
        await DeliveryModel.updateDeliveryAddress(deliveryAddressId, deliveryAddressData);
        
        res.json({
            success: true,
            message: 'Delivery address updated successfully'
        });
    } catch (error) {
        console.error('Error updating delivery address:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update delivery address',
            error: error.message
        });
    }
};

/**
 * API: Delete a delivery address
 */
exports.deleteDeliveryAddress = async (req, res) => {
    try {
        const deliveryAddressId = req.params.id;
        
        // Check if delivery address exists
        const existingAddress = await DeliveryModel.getDeliveryAddressById(deliveryAddressId);
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: 'Delivery address not found'
            });
        }
        
        // Delete the delivery address (soft delete)
        await DeliveryModel.deleteDeliveryAddress(deliveryAddressId);
        
        res.json({
            success: true,
            message: 'Delivery address deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting delivery address:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete delivery address',
            error: error.message
        });
    }
};

/**
 * API: Get delivery addresses for a specific customer
 */
exports.getCustomerDeliveryAddresses = async (req, res) => {
    try {
        const customerId = req.params.customerId;
        const deliveryAddresses = await DeliveryModel.getDeliveryAddressesByCustomerId(customerId);
        
        res.json({
            success: true,
            data: deliveryAddresses
        });
    } catch (error) {
        console.error('Error fetching customer delivery addresses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer delivery addresses',
            error: error.message
        });
    }
};

/**
 * API: Get all countries
 */
exports.getCountries = async (req, res) => {
    try {
        const countries = await DeliveryModel.getCountries();
        
        res.json({
            success: true,
            data: countries
        });
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch countries',
            error: error.message
        });
    }
};

/**
 * API: Get states by country ID
 */
exports.getStatesByCountry = async (req, res) => {
    try {
        const countryId = req.params.countryId;
        const states = await DeliveryModel.getStatesByCountry(countryId);
        
        res.json({
            success: true,
            data: states
        });
    } catch (error) {
        console.error('Error fetching states:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch states',
            error: error.message
        });
    }
};
