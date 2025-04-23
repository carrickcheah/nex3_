const customerModel = require('../models/customerModel');

// Web Controllers - Render Views
exports.renderCustomersPage = async (req, res) => {
  try {
    res.render('m_sales/Customer Setup/customer_general_setup/general_setup.ejs', {
      pageTitle: 'Customer Management',
      title: 'Customer Management',
      user: req.session?.user || {}
    });
  } catch (error) {
    console.error('Error rendering customers page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load customers page' });
  }
};

exports.renderAddCustomerPage = async (req, res) => {
  try {
    // Get customer types for the dropdown
    const customerTypes = await customerModel.getCustomerTypes();
    
    res.render('m_sales/Customer Setup/customer_general_setup/add_general_setup.ejs', {
      pageTitle: 'Add Customer',
      title: 'Add Customer',
      user: req.session?.user || {},
      customer: {},
      customerTypes,
      isEdit: false
    });
  } catch (error) {
    console.error('Error rendering add customer page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load add customer page' });
  }
};

exports.renderEditCustomerPage = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Get customer data
    const customer = await customerModel.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).render('error.ejs', { error: 'Customer not found' });
    }
    
    // Get customer types for the dropdown
    const customerTypes = await customerModel.getCustomerTypes();
    
    res.render('m_sales/Customer Setup/customer_general_setup/add_general_setup.ejs', {
      pageTitle: 'Edit Customer',
      title: 'Edit Customer',
      user: req.session?.user || {},
      customer,
      customerTypes,
      isEdit: true
    });
  } catch (error) {
    console.error('Error rendering edit customer page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load edit customer page' });
  }
};

exports.renderViewCustomerPage = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Get customer data
    const customer = await customerModel.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).render('error.ejs', { error: 'Customer not found' });
    }
    
    // Get customer types for reference
    const customerTypes = await customerModel.getCustomerTypes();
    
    // Redirect to edit page with a view-only flag
    res.render('m_sales/Customer Setup/customer_general_setup/add_general_setup.ejs', {
      pageTitle: 'View Customer',
      title: 'View Customer',
      user: req.session?.user || {},
      customer,
      customerTypes,
      isEdit: true,
      isViewOnly: true
    });
  } catch (error) {
    console.error('Error rendering view customer page:', error);
    res.status(500).render('error.ejs', { error: 'Failed to load view customer page' });
  }
};

// API Controllers - Return JSON
exports.getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const result = await customerModel.getCustomers(page, limit, search);
    
    res.json({
      success: true,
      data: result.customers,
      pagination: {
        total: result.total,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await customerModel.getCustomerById(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error.message
    });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const customerData = {
      customer_code: req.body.customer_code,
      customer_name: req.body.customer_name,
      short_name: req.body.short_name,
      tag: req.body.tag,
      account_id: req.body.account_id,
      tax_code: req.body.tax_code,
      exemption_certificate: req.body.exemption_certificate,
      payment_term: req.body.payment_term,
      customer_type_id: req.body.customer_type_id,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      status: req.body.status,
      user_id: req.session.user ? req.session.user.user_id : 1
    };
    
    const result = await customerModel.createCustomer(customerData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to create customer'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      customer_id: result.customerId
    });
  } catch (error) {
    console.error('Error in createCustomer controller:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating the customer'
    });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    const customerData = {
      customer_name: req.body.customer_name,
      short_name: req.body.short_name,
      tag: req.body.tag,
      account_id: req.body.account_id,
      tax_code: req.body.tax_code,
      exemption_certificate: req.body.exemption_certificate,
      payment_term: req.body.payment_term,
      customer_type_id: req.body.customer_type_id,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      status: req.body.status,
      user_id: req.session.user ? req.session.user.user_id : 1
    };
    
    const result = await customerModel.updateCustomer(customerId, customerData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to update customer'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error in updateCustomer controller:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the customer'
    });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Check if customer exists
    const existingCustomer = await customerModel.getCustomerById(customerId);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    await customerModel.deleteCustomer(customerId);
    
    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

exports.checkCustomerCode = async (req, res) => {
  try {
    const customerCode = req.params.code;
    const existingCustomer = await customerModel.getCustomerByCode(customerCode);
    
    res.json({
      success: true,
      exists: !!existingCustomer
    });
  } catch (error) {
    console.error('Error checking customer code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check customer code',
      error: error.message
    });
  }
}; 