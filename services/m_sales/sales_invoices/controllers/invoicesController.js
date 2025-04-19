const InvoicesModel = require('../models/invoicesModel');
const logger = require('../../../util/logger');

/**
 * Sales Invoice Controller
 */
class InvoicesController {
  /**
   * Render the sales invoices listing page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async invoicesList(req, res) {
    try {
      res.render('m_sales/sales_invoices/invoices', {
        title: 'Sales Invoices',
        user: req.session.user,
        page: 'sales_invoices'
      });
    } catch (error) {
      logger.error('Error rendering sales invoices page:', error);
      res.status(500).render('error', {
        message: 'Failed to load sales invoices page',
        error
      });
    }
  }
  
  /**
   * Render the add sales invoice page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addInvoice(req, res) {
    try {
      // Get data for dropdowns
      const [customersResult, productsResult, paymentTermsResult, shippingTermsResult, shippingPoliciesResult] = await Promise.all([
        InvoicesModel.getCustomers(),
        InvoicesModel.getProducts(),
        InvoicesModel.getPaymentTerms(),
        InvoicesModel.getShippingTerms(),
        InvoicesModel.getShippingPolicies()
      ]);

      // Generate new invoice number
      const invoiceNumberResult = await InvoicesModel.generateInvoiceNumber();
      
      res.render('m_sales/sales_invoices/add_invoices', {
        title: 'Add Sales Invoice',
        user: req.session.user,
        page: 'sales_invoices',
        mode: 'add',
        customers: customersResult.success ? customersResult.data : [],
        products: productsResult.success ? productsResult.data : [],
        paymentTerms: paymentTermsResult.success ? paymentTermsResult.data : [],
        shippingTerms: shippingTermsResult.success ? shippingTermsResult.data : [],
        shippingPolicies: shippingPoliciesResult.success ? shippingPoliciesResult.data : [],
        invoiceNumber: invoiceNumberResult.success ? invoiceNumberResult.data.invoice_number : ''
      });
    } catch (error) {
      logger.error('Error rendering add sales invoice page:', error);
      res.status(500).render('error', {
        message: 'Failed to load add sales invoice page',
        error
      });
    }
  }
  
  /**
   * Render the edit sales invoice page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async editInvoice(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).render('error', {
          message: 'Invalid invoice ID'
        });
      }

      // Get invoice details
      const invoiceResult = await InvoicesModel.getSalesInvoiceById(id);
      
      if (!invoiceResult.success) {
        return res.status(404).render('error', {
          message: invoiceResult.message || 'Invoice not found'
        });
      }

      // Get data for dropdowns
      const [customersResult, productsResult, paymentTermsResult, shippingTermsResult, shippingPoliciesResult] = await Promise.all([
        InvoicesModel.getCustomers(),
        InvoicesModel.getProducts(),
        InvoicesModel.getPaymentTerms(),
        InvoicesModel.getShippingTerms(),
        InvoicesModel.getShippingPolicies()
      ]);

      res.render('m_sales/sales_invoices/add_invoices', {
        title: 'Edit Sales Invoice',
        user: req.session.user,
        page: 'sales_invoices',
        mode: 'edit',
        invoice: invoiceResult.data,
        customers: customersResult.success ? customersResult.data : [],
        products: productsResult.success ? productsResult.data : [],
        paymentTerms: paymentTermsResult.success ? paymentTermsResult.data : [],
        shippingTerms: shippingTermsResult.success ? shippingTermsResult.data : [],
        shippingPolicies: shippingPoliciesResult.success ? shippingPoliciesResult.data : []
      });
    } catch (error) {
      logger.error('Error rendering edit sales invoice page:', error);
      res.status(500).render('error', {
        message: 'Failed to load edit sales invoice page',
        error
      });
    }
  }
  
  /**
   * Render the view sales invoice page
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async viewInvoice(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).render('error', {
          message: 'Invalid invoice ID'
        });
      }

      // Get invoice details
      const invoiceResult = await InvoicesModel.getSalesInvoiceById(id);
      
      if (!invoiceResult.success) {
        return res.status(404).render('error', {
          message: invoiceResult.message || 'Invoice not found'
        });
      }

      res.render('m_sales/sales_invoices/view_invoices', {
        title: 'View Sales Invoice',
        user: req.session.user,
        page: 'sales_invoices',
        invoice: invoiceResult.data
      });
    } catch (error) {
      logger.error('Error rendering view sales invoice page:', error);
      res.status(500).render('error', {
        message: 'Failed to load view sales invoice page',
        error
      });
    }
  }
  
  /**
   * API to get all sales invoices with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSalesInvoices(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';

      const filters = { search };
      
      const result = await InvoicesModel.getSalesInvoices(page, limit, filters);
      
      res.json(result);
    } catch (error) {
      logger.error('Error getting sales invoices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sales invoices',
        error: error.message
      });
    }
  }
  
  /**
   * API to get a sales invoice by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSalesInvoiceById(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
      }

      const result = await InvoicesModel.getSalesInvoiceById(id);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Error getting sales invoice by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sales invoice',
        error: error.message
      });
    }
  }
  
  /**
   * API to create a new sales invoice
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createSalesInvoice(req, res) {
    try {
      // Validate required fields
      const { 
        invoice_number, 
        customer_id, 
        invoice_date, 
        due_date, 
        items 
      } = req.body;

      if (!invoice_number || !customer_id || !invoice_date || !due_date || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Add created_by from session
      const invoiceData = {
        ...req.body,
        created_by: req.session.user.id
      };

      const result = await InvoicesModel.createSalesInvoice(invoiceData, items);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating sales invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create sales invoice',
        error: error.message
      });
    }
  }
  
  /**
   * API to update an existing sales invoice
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateSalesInvoice(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
      }

      // Validate required fields
      const { 
        customer_id, 
        invoice_date, 
        due_date, 
        items,
        version
      } = req.body;

      if (!customer_id || !invoice_date || !due_date || !items || !Array.isArray(items) || items.length === 0 || version === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Add updated_by from session
      const invoiceData = {
        ...req.body,
        updated_by: req.session.user.id
      };

      const result = await InvoicesModel.updateSalesInvoice(id, invoiceData, items);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Error updating sales invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update sales invoice',
        error: error.message
      });
    }
  }
  
  /**
   * API to delete a sales invoice
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteSalesInvoice(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
      }

      const result = await InvoicesModel.deleteSalesInvoice(id);
      
      if (!result.success) {
        return res.status(404).json(result);
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Error deleting sales invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete sales invoice',
        error: error.message
      });
    }
  }
  
  /**
   * API to generate a new invoice number
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateInvoiceNumber(req, res) {
    try {
      const result = await InvoicesModel.generateInvoiceNumber();
      
      res.json(result);
    } catch (error) {
      logger.error('Error generating invoice number:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice number',
        error: error.message
      });
    }
  }
  
  /**
   * API to get customers for dropdown
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCustomers(req, res) {
    try {
      const result = await InvoicesModel.getCustomers();
      
      res.json(result);
    } catch (error) {
      logger.error('Error getting customers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get customers',
        error: error.message
      });
    }
  }
  
  /**
   * API to get products for dropdown
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProducts(req, res) {
    try {
      const result = await InvoicesModel.getProducts();
      
      res.json(result);
    } catch (error) {
      logger.error('Error getting products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get products',
        error: error.message
      });
    }
  }

  /**
   * Test database connection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async testConnection(req, res) {
    try {
      const result = await InvoicesModel.testConnection();
      
      res.json(result);
    } catch (error) {
      logger.error('Error testing database connection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test database connection',
        error: error.message
      });
    }
  }
}

module.exports = InvoicesController;
