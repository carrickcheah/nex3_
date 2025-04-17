const OrderModel = require('../models/orderModel');
const moment = require('moment');

/**
 * Sales Order Controller - Handles sales order functionality
 */
class OrderController {
  /**
   * Display sales order listing page
   */
  static async orderList(req, res) {
    try {
      res.render('m_sales/sales_order/order', {
        title: 'Sales Order Management',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in orderList:', error);
      res.status(500).render('error', { 
        message: 'Error loading sales order management page',
        error: error
      });
    }
  }
  
  /**
   * Display add new sales order form
   */
  static async addOrder(req, res) {
    try {
      // Get necessary dropdown data
      const customers = await OrderModel.getCustomers();
      const paymentTerms = await OrderModel.getPaymentTerms();
      const shippingTerms = await OrderModel.getShippingTerms();
      const shippingPolicies = await OrderModel.getShippingPolicies();
      const currencies = await OrderModel.getCurrencies();
      
      // Generate new document reference
      const docRef = await OrderModel.generateDocRef();
      
      // Initialize session data for new order
      const txnMode = 'sorder_new';
      
      // Clear previous session data
      req.session[txnMode] = {
        site_id: req.session.user?.site_id || 1,
        loc_id: req.session.user?.loc_id || 1,
        txntype_id: 43, // Sales Order
        tax_reg: 1,
        parent_txntype: 41, // Sales Quotation
        parent_ids: [],
        batches: [],
        item_ids: [],
        items_list: [],
        session_key: Date.now().toString()
      };
      
      res.render('m_sales/sales_order/add_order', {
        title: 'New Sales Order',
        heading: 'New Sales Order',
        customers,
        paymentTerms,
        shippingTerms,
        shippingPolicies,
        currencies,
        docRef,
        txnDate: moment().format('DD-MM-YYYY'),
        expiryDate: moment().add(30, 'days').format('DD-MM-YYYY'),
        txnMode,
        sessionKey: req.session[txnMode].session_key,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in addOrder:', error);
      res.status(500).render('error', { 
        message: 'Error loading add sales order form',
        error: error
      });
    }
  }
  
  /**
   * Display edit sales order form
   */
  static async editOrder(req, res) {
    try {
      const orderId = req.params.id;
      const order = await OrderModel.getSalesOrderById(orderId);
      
      if (!order) {
        return res.status(404).render('error', {
          message: 'Sales Order not found',
          error: { status: 404 }
        });
      }
      
      // Get necessary dropdown data
      const customers = await OrderModel.getCustomers();
      const paymentTerms = await OrderModel.getPaymentTerms();
      const shippingTerms = await OrderModel.getShippingTerms();
      const shippingPolicies = await OrderModel.getShippingPolicies();
      const currencies = await OrderModel.getCurrencies();
      
      // Get customer addresses
      const addresses = await OrderModel.getCustomerAddresses(order.customerId);
      
      // Initialize session data for edit order
      const txnMode = 'sorder_edit';
      const txnPrev = `${txnMode}_prev`;
      
      // Store order data in session
      req.session[txnMode] = {
        txn_id: orderId,
        site_id: order.siteId,
        loc_id: order.locId,
        cust_id: order.customerId,
        txntype_id: 43, // Sales Order
        parent_txntype: 41, // Sales Quotation
        child_txntype: [45], // Sales Delivery
        parent_ids: [],
        batches: [],
        item_ids: {},
        items_list: {},
        session_key: Date.now().toString()
      };
      
      // Make a copy for tracking changes
      req.session[txnPrev] = { ...req.session[txnMode] };
      
      // Map order items to the session format
      const itemsList = {};
      order.items.forEach(item => {
        itemsList[item.rowId] = item;
      });
      
      req.session[txnMode].items_list = itemsList;
      req.session[txnPrev].items_list = { ...itemsList };
      
      res.render('m_sales/sales_order/add_order', {
        title: 'Edit Sales Order',
        heading: 'Edit Sales Order',
        order,
        customers,
        paymentTerms,
        shippingTerms,
        shippingPolicies,
        currencies,
        addresses,
        txnMode,
        sessionKey: req.session[txnMode].session_key,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in editOrder:', error);
      res.status(500).render('error', { 
        message: 'Error loading edit sales order form',
        error: error
      });
    }
  }
  
  /**
   * Display view sales order page
   */
  static async viewOrder(req, res) {
    try {
      const orderId = req.params.id;
      const order = await OrderModel.getSalesOrderById(orderId);
      
      if (!order) {
        return res.status(404).render('error', {
          message: 'Sales Order not found',
          error: { status: 404 }
        });
      }
      
      // Initialize session data for view order
      const txnMode = 'sorder_view';
      
      // Store order data in session
      req.session[txnMode] = {
        txn_id: orderId,
        site_id: order.siteId,
        loc_id: order.locId,
        cust_id: order.customerId,
        txntype_id: 43, // Sales Order
        parent_txntype: 41, // Sales Quotation
        child_txntype: [45], // Sales Delivery
        parent_ids: [],
        batches: [],
        item_ids: {},
        items_list: {},
        session_key: Date.now().toString()
      };
      
      // Map order items to the session format
      const itemsList = {};
      order.items.forEach(item => {
        itemsList[item.rowId] = item;
      });
      
      req.session[txnMode].items_list = itemsList;
      
      res.render('m_sales/sales_order/add_order', {
        title: 'View Sales Order',
        heading: 'View Sales Order',
        order,
        viewOnly: true,
        txnMode,
        sessionKey: req.session[txnMode].session_key,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in viewOrder:', error);
      res.status(500).render('error', { 
        message: 'Error loading view sales order page',
        error: error
      });
    }
  }
  
  /**
   * API: Get sales orders with pagination and filtering
   */
  static async getSalesOrders(req, res) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        docRef: req.query.docRef || '',
        customerName: req.query.customerName || '',
        status: req.query.status || '',
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || '',
        sortField: req.query.sortField || 'id',
        sortDirection: req.query.sortDirection || 'DESC'
      };
      
      console.log('Fetching orders with filters:', filters);
      const result = await OrderModel.getSalesOrders(filters);
      console.log('Raw result from database:', result);
      console.log('Number of orders returned:', result.orders ? result.orders.length : 0);
      
      if (!result.orders || result.orders.length === 0) {
        console.log('No orders returned from database');
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: filters.page,
            pages: 0
          }
        });
      }
      
      // Format dates and ensure all fields needed for the table are present
      result.orders = result.orders.map(order => {
        console.log('Processing order:', order);
        return {
          id: order.id || 0,
          importId: order.importId !== undefined && order.importId !== null ? order.importId : '',
          customerName: order.customerName || '',
          txnDate: moment(order.txnDate).format('DD-MM-YYYY'),
          docRef: order.docRef || '',
          poNo: order.poNo || '',
          shippingTerm: order.shippingTermId ? `Term ID: ${order.shippingTermId}` : '',
          salesPerson: order.salesPersonId && order.salesPersonName ? 
                      `${order.salesPersonId} ${order.salesPersonName}` : 
                      (order.salesPersonName || ''),
          currencyCode: order.currencyCode || '',
          grandTotal: parseFloat(order.grandTotal || 0).toFixed(2),
          status: order.status || 'P',
          statusText: getStatusText(order.status || 'P'),
          statusClass: getStatusClass(order.status || 'P')
        };
      });
      
      return res.status(200).json({
        success: true,
        data: result.orders,
        pagination: {
          total: result.total,
          page: result.page,
          pages: result.pages
        }
      });
    } catch (error) {
      console.error('Error in getSalesOrders:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching sales orders',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get sales order by ID
   */
  static async getSalesOrderById(req, res) {
    try {
      const orderId = req.params.id;
      const order = await OrderModel.getSalesOrderById(orderId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Sales Order not found'
        });
      }
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Error in getSalesOrderById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving sales order',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new sales order
   */
  static async createSalesOrder(req, res) {
    try {
      const orderData = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!orderData.customerId || !orderData.txnDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Create sales order
      const result = await OrderModel.createSalesOrder(orderData, userId);
      
      res.status(201).json({
        success: true,
        message: 'Sales Order created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in createSalesOrder API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating sales order',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update sales order
   */
  static async updateSalesOrder(req, res) {
    try {
      const orderId = req.params.id;
      const orderData = req.body;
      const userId = req.session.user?.id || 1;
      
      // Validate required fields
      if (!orderData.customerId || !orderData.txnDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Update sales order
      const result = await OrderModel.updateSalesOrder(orderId, orderData, userId);
      
      res.json({
        success: true,
        message: 'Sales Order updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateSalesOrder API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sales order',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get customer addresses
   */
  static async getCustomerAddresses(req, res) {
    try {
      const customerId = req.params.id;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required'
        });
      }
      
      const addresses = await OrderModel.getCustomerAddresses(customerId);
      
      res.json({
        success: true,
        data: addresses
      });
    } catch (error) {
      console.error('Error in getCustomerAddresses API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customer addresses',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get products
   */
  static async getProducts(req, res) {
    try {
      const products = await OrderModel.getProducts();
      
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
   * API: Generate new document reference
   */
  static async generateDocRef(req, res) {
    try {
      const docRef = await OrderModel.generateDocRef();
      
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
}

/**
 * Get text representation of status code
 * @param {string} statusCode Status code
 * @returns {string} Status text
 */
function getStatusText(statusCode) {
  const statusMap = {
    'P': 'Pending',
    'DF': 'Confirm',
    'CF': 'Confirmed',
    'A': 'Approved',
    'CP': 'Completed',
    'V': 'Voided',
    'X': 'Cancelled'
  };
  
  return statusMap[statusCode] || statusCode;
}

/**
 * Get CSS class for status
 * @param {string} statusCode Status code
 * @returns {string} CSS class
 */
function getStatusClass(statusCode) {
  const classMap = {
    'P': 'text-warning',
    'DF': 'text-primary',
    'CF': 'text-primary',
    'A': 'text-info',
    'CP': 'text-success',
    'V': 'text-danger',
    'X': 'text-secondary'
  };
  
  return classMap[statusCode] || '';
}

module.exports = OrderController;
