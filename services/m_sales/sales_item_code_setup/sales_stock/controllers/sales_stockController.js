const SalesStockModel = require('../models/sales_stockModel');

// Controller to handle fetching all stock codes with pagination, search, and sorting
exports.getAllStockCodes = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        // Pass frontend field names for sorting; model will map them
        const sortField = req.query.sort_field || 'id'; 
        const sortOrder = req.query.sort_order || 'asc'; 

        const result = await SalesStockModel.getAll(page, limit, search, sortField, sortOrder);

        res.json({
            success: true,
            data: result.data,
            pagination: {
                total: result.total,
                total_pages: Math.ceil(result.total / limit),
                current_page: page,
                limit: limit
            }
        });
    } catch (error) {
        console.error('Error fetching stock codes:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stock codes', error: error.message });
    }
};

// Controller to handle fetching a single stock code by ID
exports.getStockCodeById = async (req, res) => {
    try {
        const id = req.params.id;
        const stockCode = await SalesStockModel.getById(id);

        if (!stockCode) {
            return res.status(404).json({ success: false, message: 'Stock code not found' });
        }

        res.json({ success: true, data: stockCode });
    } catch (error) {
        console.error('Error fetching stock code by ID:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stock code', error: error.message });
    }
};

// Controller to handle creating a new stock code
exports.createStockCode = async (req, res) => {
    try {
        // Destructure needed fields, price_decimal removed
        const { stock_code, product_name, base_uom, status } = req.body;

        // Basic validation - removed price_decimal validation
        if (!stock_code || !product_name || !base_uom ) {
            return res.status(400).json({ success: false, message: 'Missing required fields (Stock Code, Product Name, Base UOM)' });
        }
        // Add validation for status if necessary (e.g., must be 0 or 1)
        if (status !== undefined && status !== '0' && status !== '1') {
             return res.status(400).json({ success: false, message: 'Invalid status value (must be 0 or 1)' });
        }
       
        // Check if stock code already exists (using actual StkCode_v)
        const exists = await SalesStockModel.checkExists(stock_code);
        if (exists) {
            return res.status(409).json({ success: false, message: 'Stock code already exists' });
        }

        // Create stock code (model handles UOM lookup and status mapping)
        const newStockCodeId = await SalesStockModel.create(req.body);
        res.status(201).json({ 
            success: true, 
            message: 'Stock code created successfully', 
            id: newStockCodeId 
        });
    } catch (error) {
        console.error('Error creating stock code:', error);
        // Handle specific errors like invalid UOM from model
        if (error.message.includes('Invalid Base UOM')) {
             return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to create stock code', error: error.message });
    }
};

// Controller to handle updating an existing stock code
exports.updateStockCode = async (req, res) => {
    try {
        const id = req.params.id;
        // Destructure needed fields, price_decimal removed
        const { stock_code, product_name, base_uom, status } = req.body;

        // Basic validation - removed price_decimal
        if (!stock_code || !product_name || !base_uom || status === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields for update (Stock Code, Product Name, Base UOM, Status)' });
        }
        if (status !== '0' && status !== '1') { // Check if status is valid (0 or 1)
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        // Check if the stock code we are trying to update exists using the ID
        // We fetch using getById which already checks Deleted_c = '0'
        const currentStock = await SalesStockModel.getById(id);
        if (!currentStock) {
            // If getById returns null, it means not found or already deleted
            return res.status(404).json({ success: false, message: 'Stock code not found or is deleted' });
        }

        // Check if the new stock_code conflicts with another existing record (using actual StkCode_v)
        const exists = await SalesStockModel.checkExists(stock_code, id); // Exclude current ID
        if (exists) {
            return res.status(409).json({ success: false, message: 'Stock code already exists' });
        }

        // Update stock code (model handles UOM lookup and status mapping)
        const updated = await SalesStockModel.update(id, req.body);
        if (!updated) {
             return res.status(500).json({ success: false, message: 'Stock code update failed' });
        }

        res.json({ success: true, message: 'Stock code updated successfully' });
    } catch (error) {
        console.error('Error updating stock code:', error);
         // Handle specific errors like invalid UOM from model
        if (error.message.includes('Invalid Base UOM')) {
             return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update stock code', error: error.message });
    }
};

// Controller to handle deleting (soft delete) a stock code
exports.deleteStockCode = async (req, res) => {
    try {
        const id = req.params.id;

        // Check if the stock code exists and is not already deleted before attempting deletion
        const stockCode = await SalesStockModel.getById(id);
        if (!stockCode) {
            return res.status(404).json({ success: false, message: 'Stock code not found or already deleted' });
        }

        // Perform soft delete (model updates Deleted_c to '1')
        const deleted = await SalesStockModel.delete(id);
        if (!deleted) {
            // This case might be less likely now with the check above, but keep for robustness
            return res.status(500).json({ success: false, message: 'Failed to delete stock code' });
        }

        res.json({ success: true, message: 'Stock code deleted successfully' });
    } catch (error) {
        console.error('Error deleting stock code:', error);
        res.status(500).json({ success: false, message: 'Failed to delete stock code', error: error.message });
    }
};