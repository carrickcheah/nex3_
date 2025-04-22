const ReturnModel = require('../models/returnModel');
const moment = require('moment');

/**
 * Sales Return Controller - Handles sales return functionality
 */
class ReturnController {
  /**
   * Display sales return listing page
   */
  static async returnList(req, res) {
    try {
      res.render('m_sales/sales_return/sales_return', {
        title: 'Sales Returns',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in returnList:', error);
      res.status(500).render('error', { 
        message: 'Error loading sales return page',
        error: error
      });
    }
  }
  
  /**
   * Display add sales return page
   */
  static async addReturn(req, res) {
    try {
      // Get customers for dropdown
      const customers = await ReturnModel.getCustomers();
      
      res.render('m_sales/sales_return/add_return', {
        title: 'Add Sales Return',
        heading: 'Create New Sales Return',
        salesReturn: null,
        customers,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in addReturn:', error);
      res.status(500).render('error', { 
        message: 'Error loading add sales return page',
        error: error
      });
    }
  }
  
  /**
   * Display edit sales return page
   */
  static async editReturn(req, res) {
    try {
      const id = req.params.id;
      const salesReturn = await ReturnModel.getReturnById(id);
      
      if (!salesReturn) {
        return res.status(404).render('error', {
          message: 'Sales Return not found',
          error: { status: 404 }
        });
      }
      
      // Get customers for dropdown
      const customers = await ReturnModel.getCustomers();
      
      res.render('m_sales/sales_return/add_return', {
        title: 'Edit Sales Return',
        heading: 'Edit Sales Return',
        salesReturn,
        customers,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in editReturn:', error);
      res.status(500).render('error', { 
        message: 'Error loading edit sales return page',
        error: error
      });
    }
  }
  
  /**
   * Display view sales return page
   */
  static async viewReturn(req, res) {
    try {
      const id = req.params.id;
      const salesReturn = await ReturnModel.getReturnById(id);
      
      if (!salesReturn) {
        return res.status(404).render('error', {
          message: 'Sales Return not found',
          error: { status: 404 }
        });
      }
      
      res.render('m_sales/sales_return/view_return', {
        title: 'View Sales Return',
        heading: 'View Sales Return',
        salesReturn,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in viewReturn:', error);
      res.status(500).render('error', { 
        message: 'Error loading view sales return page',
        error: error
      });
    }
  }
  
  /**
   * API: Get sales returns with pagination and filtering
   */
  static async getReturns(req, res) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        returnNumber: req.query.returnNumber || '',
        customerName: req.query.customerName || '',
        status: req.query.status || '',
        monthsBack: req.query.dateFilter || '3',
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || ''
      };
      
      const result = await ReturnModel.getReturns(filters);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in getReturns:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching sales returns',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get sales return by ID
   */
  static async getReturnById(req, res) {
    try {
      const id = req.params.id;
      const salesReturn = await ReturnModel.getReturnById(id);
      
      if (!salesReturn) {
        return res.status(404).json({
          success: false,
          message: 'Sales Return not found'
        });
      }
      
      res.json({
        success: true,
        data: salesReturn
      });
    } catch (error) {
      console.error('Error in getReturnById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving sales return',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new sales return
   */
  static async createReturn(req, res) {
    try {
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!data.customerId || !data.returnDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Create sales return
      const result = await ReturnModel.createReturn(data, userId);
      
      res.status(201).json({
        success: true,
        message: 'Sales Return created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createReturn API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating sales return',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update sales return
   */
  static async updateReturn(req, res) {
    try {
      const id = req.params.id;
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Check if sales return exists
      const existingReturn = await ReturnModel.getReturnById(id);
      if (!existingReturn) {
        return res.status(404).json({
          success: false,
          message: 'Sales Return not found'
        });
      }
      
      // Update sales return
      const result = await ReturnModel.updateReturn(id, data, userId);
      
      res.json({
        success: true,
        message: 'Sales Return updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateReturn API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sales return',
        error: error.message
      });
    }
  }
  
  /**
   * API: Delete sales return
   */
  static async deleteReturn(req, res) {
    try {
      const id = req.params.id;
      
      // Check if sales return exists
      const existingReturn = await ReturnModel.getReturnById(id);
      if (!existingReturn) {
        return res.status(404).json({
          success: false,
          message: 'Sales Return not found'
        });
      }
      
      // Delete sales return
      await ReturnModel.deleteReturn(id);
      
      res.json({
        success: true,
        message: 'Sales Return deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteReturn API:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting sales return',
        error: error.message
      });
    }
  }
  
  /**
   * API: Generate unique document reference number
   */
  static async generateDocRef(req, res) {
    try {
      const docRef = await ReturnModel.generateDocRef();
      
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
      const customers = await ReturnModel.getCustomers();
      
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
      const products = await ReturnModel.getProducts();
      
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
   * API: Get invoices for dropdown
   */
  static async getInvoices(req, res) {
    try {
      const customerId = req.query.customerId;
      const invoices = await ReturnModel.getInvoices(customerId);
      
      res.json({
        success: true,
        data: invoices
      });
    } catch (error) {
      console.error('Error in getInvoices API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving invoices',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get deliveries for dropdown
   */
  static async getDeliveries(req, res) {
    try {
      const customerId = req.query.customerId;
      const deliveries = await ReturnModel.getDeliveries(customerId);
      
      res.json({
        success: true,
        data: deliveries
      });
    } catch (error) {
      console.error('Error in getDeliveries API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving deliveries',
        error: error.message
      });
    }
  }
  
  /**
   * API: Test database connection
   */
  static async testConnection(req, res) {
    try {
      const connection = await ReturnModel.testConnection();
      
      // Try to get the database structure to verify table exists
      const pool = require('../../../config/database');
      const dbConnection = await pool.getConnection();
      
      try {
        console.log('Checking database structure...');
        
        // Check if the tbl_sreturn_txn table exists
        const [tables] = await dbConnection.execute(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_sreturn_txn'"
        );
        
        let tableExists = tables.length > 0;
        
        // If table exists, get its column structure
        let columns = [];
        if (tableExists) {
          const [columnInfo] = await dbConnection.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_sreturn_txn'"
          );
          columns = columnInfo;
          
          // Try to get a sample row to see actual data
          const [sampleData] = await dbConnection.execute(
            "SELECT * FROM tbl_sreturn_txn LIMIT 1"
          );
          
          res.json({
            success: true,
            message: 'Database connection successful',
            dbStructure: {
              tableExists,
              columns,
              sampleRow: sampleData.length > 0 ? sampleData[0] : null
            }
          });
        } else {
          res.json({
            success: true,
            message: 'Database connection successful, but target table not found',
            dbStructure: {
              tableExists,
              availableTables: await getAvailableTables(dbConnection)
            }
          });
        }
      } catch (structureError) {
        console.error('Error checking database structure:', structureError);
        res.json({
          success: true,
          message: 'Database connection successful, but error checking structure',
          error: structureError.message
        });
      } finally {
        dbConnection.release();
      }
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

// Helper function to get available tables
async function getAvailableTables(connection) {
  try {
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    );
    return tables.map(t => t.TABLE_NAME);
  } catch (error) {
    console.error('Error fetching available tables:', error);
    return ['Error fetching tables: ' + error.message];
  }
}

module.exports = ReturnController;
