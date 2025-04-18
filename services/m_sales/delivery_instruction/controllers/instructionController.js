const InstructionModel = require('../models/instructionModel');
const moment = require('moment');

/**
 * Sales Delivery Instruction Controller - Handles delivery instruction functionality
 */
class InstructionController {
  /**
   * Display delivery instruction listing page
   */
  static async instructionList(req, res) {
    try {
      res.render('m_sales/delivery_instruction/instruction', {
        title: 'Sales Delivery Instruction',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in instructionList:', error);
      res.status(500).render('error', { 
        message: 'Error loading sales delivery instruction page',
        error: error
      });
    }
  }
  
  /**
   * Display add new delivery instruction form
   */
  static async addInstruction(req, res) {
    try {
      // Get necessary dropdown data
      const customers = await InstructionModel.getCustomers();
      const products = await InstructionModel.getProducts();
      
      // Generate new document reference
      const docRef = await InstructionModel.generateDocRef();
      
      // Initialize session data for new instruction
      req.session.sdi_new = {
        site_id: req.session.user?.site_id || 1,
        loc_id: req.session.user?.loc_id || 1,
        items: [],
        session_key: Date.now().toString()
      };
      
      res.render('m_sales/delivery_instruction/add_instruction', {
        title: 'New Delivery Instruction',
        heading: 'New Delivery Instruction',
        customers,
        products,
        docRef,
        txnDate: moment().format('DD-MM-YYYY'),
        deliveryDate: moment().add(1, 'days').format('DD-MM-YYYY'),
        sessionKey: req.session.sdi_new.session_key,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in addInstruction:', error);
      res.status(500).render('error', { 
        message: 'Error loading add delivery instruction form',
        error: error
      });
    }
  }
  
  /**
   * Display edit delivery instruction form
   */
  static async editInstruction(req, res) {
    try {
      const id = req.params.id;
      const instruction = await InstructionModel.getDeliveryInstructionById(id);
      
      if (!instruction) {
        return res.status(404).render('error', {
          message: 'Delivery Instruction not found',
          error: { status: 404 }
        });
      }
      
      // Get necessary dropdown data
      const customers = await InstructionModel.getCustomers();
      const products = await InstructionModel.getProducts();
      
      // Initialize session data for edit
      req.session.sdi_edit = {
        id: instruction.id,
        site_id: instruction.siteId,
        loc_id: instruction.locId,
        items: instruction.items || [],
        session_key: Date.now().toString()
      };
      
      res.render('m_sales/delivery_instruction/add_instruction', {
        title: 'Edit Delivery Instruction',
        heading: 'Edit Delivery Instruction',
        instruction,
        customers,
        products,
        isEdit: true,
        sessionKey: req.session.sdi_edit.session_key,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in editInstruction:', error);
      res.status(500).render('error', { 
        message: 'Error loading edit delivery instruction form',
        error: error
      });
    }
  }
  
  /**
   * Display view delivery instruction page
   */
  static async viewInstruction(req, res) {
    try {
      const id = req.params.id;
      const instruction = await InstructionModel.getDeliveryInstructionById(id);
      
      if (!instruction) {
        return res.status(404).render('error', {
          message: 'Delivery Instruction not found',
          error: { status: 404 }
        });
      }
      
      res.render('m_sales/delivery_instruction/add_instruction', {
        title: 'View Delivery Instruction',
        heading: 'View Delivery Instruction',
        instruction,
        viewOnly: true,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in viewInstruction:', error);
      res.status(500).render('error', { 
        message: 'Error loading view delivery instruction page',
        error: error
      });
    }
  }
  
  /**
   * API: Get delivery instructions with pagination and filtering
   */
  static async getDeliveryInstructions(req, res) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        docRef: req.query.docRef || '',
        customerName: req.query.customerName || '',
        status: req.query.status || '',
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || ''
      };
      
      console.log('Fetching delivery instructions with filters:', filters);
      const result = await InstructionModel.getDeliveryInstructions(filters);
      
      return res.status(200).json({
        success: true,
        data: result.instructions,
        pagination: {
          total: result.total,
          page: result.page,
          pages: result.pages
        }
      });
    } catch (error) {
      console.error('Error in getDeliveryInstructions:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching delivery instructions',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get delivery instruction by ID
   */
  static async getDeliveryInstructionById(req, res) {
    try {
      const id = req.params.id;
      const instruction = await InstructionModel.getDeliveryInstructionById(id);
      
      if (!instruction) {
        return res.status(404).json({
          success: false,
          message: 'Delivery Instruction not found'
        });
      }
      
      res.json({
        success: true,
        data: instruction
      });
    } catch (error) {
      console.error('Error in getDeliveryInstructionById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving delivery instruction',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new delivery instruction
   */
  static async createDeliveryInstruction(req, res) {
    try {
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!data.customerId || !data.txnDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Create delivery instruction
      const result = await InstructionModel.createDeliveryInstruction(data, userId);
      
      // Clear session data
      delete req.session.sdi_new;
      
      res.status(201).json({
        success: true,
        message: 'Delivery Instruction created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createDeliveryInstruction API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating delivery instruction',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update delivery instruction
   */
  static async updateDeliveryInstruction(req, res) {
    try {
      const id = req.params.id;
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!data.customerId || !data.txnDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Update delivery instruction
      const result = await InstructionModel.updateDeliveryInstruction(id, data, userId);
      
      // Clear session data
      delete req.session.sdi_edit;
      
      res.json({
        success: true,
        message: 'Delivery Instruction updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateDeliveryInstruction API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating delivery instruction',
        error: error.message
      });
    }
  }
  
  /**
   * API: Generate new document reference
   */
  static async generateDocRef(req, res) {
    try {
      const docRef = await InstructionModel.generateDocRef();
      
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
   * API: Test connection endpoint
   */
  static async testConnection(req, res) {
    try {
      res.json({
        success: true,
        message: 'API connection successful',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error in test API:', error);
      res.status(500).json({
        success: false,
        message: 'API connection error',
        error: error.message
      });
    }
  }
}

module.exports = InstructionController;
