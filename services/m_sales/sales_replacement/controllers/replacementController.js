const ReplacementModel = require('../models/replacementModel');
const moment = require('moment');

/**
 * Sales Replacement Controller - Handles sales replacement functionality
 */
class ReplacementController {
  /**
   * Display sales replacement listing page
   */
  static async replacementList(req, res) {
    try {
      res.render('m_sales/sales_replacement/table_sales_replacement', {
        title: 'Sales Replacements',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in replacementList:', error);
      res.status(500).render('error', { 
        message: 'Error loading sales replacement page',
        error: error
      });
    }
  }
  
  /**
   * Display add sales replacement page
   */
  static async addReplacement(req, res) {
    try {
      // Get customers for dropdown
      const customers = await ReplacementModel.getCustomers();
      
      res.render('m_sales/sales_replacement/add_sales_replacement', {
        title: 'Add Sales Replacement',
        heading: 'Create New Sales Replacement',
        replacement: null,
        customers,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in addReplacement:', error);
      res.status(500).render('error', { 
        message: 'Error loading add sales replacement page',
        error: error
      });
    }
  }
  
  /**
   * Display edit sales replacement page
   */
  static async editReplacement(req, res) {
    try {
      const id = req.params.id;
      const replacement = await ReplacementModel.getReplacementById(id);
      
      if (!replacement) {
        return res.status(404).render('error', {
          message: 'Sales Replacement not found',
          error: { status: 404 }
        });
      }
      
      // Get customers for dropdown
      const customers = await ReplacementModel.getCustomers();
      
      res.render('m_sales/sales_replacement/add_sales_replacement', {
        title: 'Edit Sales Replacement',
        heading: 'Edit Sales Replacement',
        replacement,
        customers,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in editReplacement:', error);
      res.status(500).render('error', { 
        message: 'Error loading edit sales replacement page',
        error: error
      });
    }
  }
  
  /**
   * Display view sales replacement page
   */
  static async viewReplacement(req, res) {
    try {
      const id = req.params.id;
      const replacement = await ReplacementModel.getReplacementById(id);
      
      if (!replacement) {
        return res.status(404).render('error', {
          message: 'Sales Replacement not found',
          error: { status: 404 }
        });
      }
      
      res.render('m_sales/sales_replacement/view_replacement', {
        title: 'View Sales Replacement',
        heading: 'View Sales Replacement',
        replacement,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in viewReplacement:', error);
      res.status(500).render('error', { 
        message: 'Error loading view sales replacement page',
        error: error
      });
    }
  }
  
  /**
   * API: Get sales replacements with pagination and filtering
   */
  static async getReplacements(req, res) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        replacementNumber: req.query.replacementNumber || '',
        customerName: req.query.customerName || '',
        status: req.query.status || '',
        monthsBack: req.query.dateFilter || '3',
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || ''
      };
      
      const result = await ReplacementModel.getReplacements(filters);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in getReplacements:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching sales replacements',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get sales replacement by ID
   */
  static async getReplacementById(req, res) {
    try {
      const id = req.params.id;
      const replacement = await ReplacementModel.getReplacementById(id);
      
      if (!replacement) {
        return res.status(404).json({
          success: false,
          message: 'Sales Replacement not found'
        });
      }
      
      res.json({
        success: true,
        data: replacement
      });
    } catch (error) {
      console.error('Error in getReplacementById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving sales replacement',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new sales replacement
   */
  static async createReplacement(req, res) {
    try {
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!data.customerId || !data.replacementDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Create sales replacement
      const result = await ReplacementModel.createReplacement(data, userId);
      
      res.status(201).json({
        success: true,
        message: 'Sales Replacement created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createReplacement API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating sales replacement',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update sales replacement
   */
  static async updateReplacement(req, res) {
    try {
      const id = req.params.id;
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Check if sales replacement exists
      const existingReplacement = await ReplacementModel.getReplacementById(id);
      if (!existingReplacement) {
        return res.status(404).json({
          success: false,
          message: 'Sales Replacement not found'
        });
      }
      
      // Update sales replacement
      const result = await ReplacementModel.updateReplacement(id, data, userId);
      
      res.json({
        success: true,
        message: 'Sales Replacement updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateReplacement API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sales replacement',
        error: error.message
      });
    }
  }
  
  /**
   * API: Delete sales replacement
   */
  static async deleteReplacement(req, res) {
    try {
      const id = req.params.id;
      
      // Check if sales replacement exists
      const existingReplacement = await ReplacementModel.getReplacementById(id);
      if (!existingReplacement) {
        return res.status(404).json({
          success: false,
          message: 'Sales Replacement not found'
        });
      }
      
      // Delete sales replacement
      await ReplacementModel.deleteReplacement(id);
      
      res.json({
        success: true,
        message: 'Sales Replacement deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteReplacement API:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting sales replacement',
        error: error.message
      });
    }
  }
  
  /**
   * API: Generate unique document reference number
   */
  static async generateDocRef(req, res) {
    try {
      const docRef = await ReplacementModel.generateDocRef();
      
      res.json({
        success: true,
        data: {
          docRef
        }
      });
    } catch (error) {
      console.error('Error in generateDocRef API:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating document reference',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get customers for dropdown
   */
  static async getCustomers(req, res) {
    try {
      const customers = await ReplacementModel.getCustomers();
      
      res.json({
        success: true,
        data: customers
      });
    } catch (error) {
      console.error('Error in getCustomers API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customers',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get products for dropdown
   */
  static async getProducts(req, res) {
    try {
      const products = await ReplacementModel.getProducts();
      
      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Error in getProducts API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving products',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get sales returns for dropdown
   */
  static async getReturns(req, res) {
    try {
      const customerId = req.query.customerId;
      const returns = await ReplacementModel.getReturns(customerId);
      
      res.json({
        success: true,
        data: returns
      });
    } catch (error) {
      console.error('Error in getReturns API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving sales returns',
        error: error.message
      });
    }
  }
  
  /**
   * API: Test database connection
   */
  static async testConnection(req, res) {
    try {
      const result = await ReplacementModel.testConnection();
      
      res.json({
        success: true,
        message: 'Database connection successful',
        data: result
      });
    } catch (error) {
      console.error('Error in testConnection API:', error);
      res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message
      });
    }
  }
}

module.exports = ReplacementController;
