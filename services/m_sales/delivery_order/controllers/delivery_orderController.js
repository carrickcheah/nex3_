const DeliveryOrderModel = require('../models/delivery_orderModel');
const moment = require('moment');

/**
 * Delivery Order Controller - Handles delivery order functionality
 */
class DeliveryOrderController {
  /**
   * Display delivery order listing page
   */
  static async deliveryOrderList(req, res) {
    try {
      res.render('m_sales/delivery_order/delivery_order', {
        title: 'Delivery Orders',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in deliveryOrderList:', error);
      res.status(500).render('error', { 
        message: 'Error loading delivery order page',
        error: error
      });
    }
  }
  
  /**
   * Display view delivery order page
   */
  static async viewDeliveryOrder(req, res) {
    try {
      const id = req.params.id;
      const deliveryOrder = await DeliveryOrderModel.getDeliveryOrderById(id);
      
      if (!deliveryOrder) {
        return res.status(404).render('error', {
          message: 'Delivery Order not found',
          error: { status: 404 }
        });
      }
      
      res.render('m_sales/delivery_order/view_delivery_order', {
        title: 'View Delivery Order',
        heading: 'View Delivery Order',
        deliveryOrder,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in viewDeliveryOrder:', error);
      res.status(500).render('error', { 
        message: 'Error loading view delivery order page',
        error: error
      });
    }
  }
  
  /**
   * API: Get delivery orders with pagination and filtering
   */
  static async getDeliveryOrders(req, res) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        doNumber: req.query.doNumber || '',
        customerName: req.query.customerName || '',
        status: req.query.status || '',
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || ''
      };
      
      console.log('Fetching delivery orders with filters:', filters);
      const result = await DeliveryOrderModel.getDeliveryOrders(filters);
      
      // The model now returns a result with success, data, and pagination properties
      // so we can just return it directly
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in getDeliveryOrders:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching delivery orders',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get delivery order by ID
   */
  static async getDeliveryOrderById(req, res) {
    try {
      const id = req.params.id;
      const deliveryOrder = await DeliveryOrderModel.getDeliveryOrderById(id);
      
      if (!deliveryOrder) {
        return res.status(404).json({
          success: false,
          message: 'Delivery Order not found'
        });
      }
      
      res.json({
        success: true,
        data: deliveryOrder
      });
    } catch (error) {
      console.error('Error in getDeliveryOrderById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving delivery order',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new delivery order
   */
  static async createDeliveryOrder(req, res) {
    try {
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!data.customerId || !data.doDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Create delivery order
      const result = await DeliveryOrderModel.createDeliveryOrder(data, userId);
      
      res.status(201).json({
        success: true,
        message: 'Delivery Order created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createDeliveryOrder API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating delivery order',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update delivery order
   */
  static async updateDeliveryOrder(req, res) {
    try {
      const id = req.params.id;
      const data = req.body;
      const userId = req.session.user?.id || 1;
      
      // Check if delivery order exists
      const existingOrder = await DeliveryOrderModel.getDeliveryOrderById(id);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: 'Delivery Order not found'
        });
      }
      
      // Update delivery order
      const result = await DeliveryOrderModel.updateDeliveryOrder(id, data, userId);
      
      res.json({
        success: true,
        message: 'Delivery Order updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateDeliveryOrder API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating delivery order',
        error: error.message
      });
    }
  }
  
  /**
   * API: Generate unique document reference number
   */
  static async generateDocRef(req, res) {
    try {
      const docRef = await DeliveryOrderModel.generateDocRef();
      
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
   * API: Test database connection
   */
  static async testConnection(req, res) {
    try {
      await DeliveryOrderModel.testConnection();
      
      res.json({
        success: true,
        message: 'Database connection successful'
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

module.exports = DeliveryOrderController;
