const priceModel = require('../models/priceModel');

// Web controllers (render views)
exports.renderPriceListPage = async (req, res) => {
  try {
    res.render('m_sales/customer_setup/customer_price_list/table_price_list.ejs', {
      pageTitle: 'Customer Price List',
      title: 'Sales',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error rendering price list page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load price list page' });
  }
};

exports.renderAddPriceListPage = async (req, res) => {
  try {
    // Fetch customers and products for dropdowns
    const customers = await fetchCustomers();
    const products = await fetchProducts();
    
    res.render('m_sales/customer_setup/customer_price_list/add_price_list.ejs', {
      pageTitle: 'Add Price List Item',
      title: 'Sales',
      user: req.session.user,
      customers,
      products
    });
  } catch (error) {
    console.error('Error rendering add price list page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load add price list page' });
  }
};

exports.renderEditPriceListPage = async (req, res) => {
  try {
    const { id } = req.params;
    const priceItem = await priceModel.getPriceListItemById(id);
    
    if (!priceItem) {
      return res.status(404).render('error.ejs', { error: 'Price list item not found' });
    }
    
    // Fetch customers and products for dropdowns
    const customers = await fetchCustomers();
    const products = await fetchProducts();
    
    res.render('m_sales/customer_setup/customer_price_list/edit_price_list.ejs', {
      pageTitle: 'Edit Price List Item',
      title: 'Sales',
      user: req.session.user,
      priceList: priceItem,
      customers,
      products
    });
  } catch (error) {
    console.error('Error rendering edit price list page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load edit price list page' });
  }
};

exports.renderViewPriceListPage = async (req, res) => {
  try {
    const { id } = req.params;
    const priceItem = await priceModel.getPriceListItemById(id);
    
    if (!priceItem) {
      return res.status(404).render('error.ejs', { error: 'Price list item not found' });
    }
    
    res.render('m_sales/customer_setup/customer_price_list/view_price_list.ejs', {
      pageTitle: 'View Price List Item',
      title: 'Sales',
      user: req.session.user,
      priceList: priceItem
    });
  } catch (error) {
    console.error('Error rendering view price list page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load view price list page' });
  }
};

// API controllers (return JSON)
exports.getPriceList = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      sortField = 'customer',
      sortOrder = 'asc'
    } = req.query;
    
    const result = await priceModel.getPriceList(
      parseInt(page), 
      parseInt(limit), 
      search,
      sortField,
      sortOrder
    );
    
    res.json({
      success: true,
      data: result.priceListItems,
      pagination: {
        total: result.total,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching price list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch price list',
      error: error.message
    });
  }
};

exports.getPriceListItem = async (req, res) => {
  try {
    const { id } = req.params;
    const priceItem = await priceModel.getPriceListItemById(id);
    
    if (!priceItem) {
      return res.status(404).json({
        success: false,
        message: 'Price list item not found'
      });
    }
    
    res.json({
      success: true,
      data: priceItem
    });
  } catch (error) {
    console.error('Error fetching price list item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch price list item',
      error: error.message
    });
  }
};

exports.createPriceListItem = async (req, res) => {
  try {
    const {
      customer_id,
      stock_code,
      moq,
      currency,
      unit_price,
      effective_date,
      status
    } = req.body;
    
    // Basic validation
    if (!customer_id || !stock_code || !unit_price || !effective_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const newItemId = await priceModel.createPriceListItem({
      customer_id,
      stock_code,
      moq,
      currency,
      unit_price,
      effective_date,
      status,
      created_by: req.session?.user?.user_id || 1
    });
    
    res.status(201).json({
      success: true,
      message: 'Price list item created successfully',
      data: { id: newItemId }
    });
  } catch (error) {
    console.error('Error creating price list item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create price list item',
      error: error.message
    });
  }
};

exports.updatePriceListItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_id,
      stock_code,
      moq,
      currency,
      unit_price,
      effective_date,
      status
    } = req.body;
    
    // Basic validation
    if (!customer_id || !stock_code || !unit_price || !effective_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const updated = await priceModel.updatePriceListItem(id, {
      customer_id,
      stock_code,
      moq,
      currency,
      unit_price,
      effective_date,
      status,
      updated_by: req.session?.user?.user_id || 1
    });
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Price list item not found or not updated'
      });
    }
    
    res.json({
      success: true,
      message: 'Price list item updated successfully'
    });
  } catch (error) {
    console.error('Error updating price list item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update price list item',
      error: error.message
    });
  }
};

exports.deletePriceListItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await priceModel.deletePriceListItem(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Price list item not found or not deleted'
      });
    }
    
    res.json({
      success: true,
      message: 'Price list item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting price list item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete price list item',
      error: error.message
    });
  }
};

// Helper functions to fetch dropdown data
async function fetchCustomers() {
  try {
    const [rows] = await require('../../../../config/database').query(
      'SELECT CustId_i as customer_id, CustName_v as customer_name FROM tbl_customer WHERE Status_c = 1'
    );
    return rows;
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

async function fetchProducts() {
  try {
    const [rows] = await require('../../../../config/database').query(
      'SELECT StkId_i as stock_id, StkCode_v as stock_code, ProdName_v as product_name FROM tbl_product_code WHERE Status_c = 1'
    );
    return rows;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

module.exports = exports;
