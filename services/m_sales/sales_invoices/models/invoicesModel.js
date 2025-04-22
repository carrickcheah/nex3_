const db = require('../../../config/database');
const logger = require('../../../util/logger');
const moment = require('moment');

/**
 * Sales Invoice Model - Database operations for sales invoices
 */
class InvoicesModel {
  /**
   * Get all sales invoices with pagination and filtering
   * @param {number} page - Page number
   * @param {number} limit - Number of records per page
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} - Sales invoices data with pagination
   */
  static async getSalesInvoices(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      
      // Build the WHERE clause based on filters
      let whereClause = '';
      const params = [];
      
      if (filters.search) {
        whereClause = ' WHERE c.CustName_v LIKE ? OR si.DocRef_v LIKE ?';
        params.push(`%${filters.search}%`);
        params.push(`%${filters.search}%`);
      }
      
      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM nex_valiant.tbl_sinvoice_txn si
        LEFT JOIN tbl_customer c ON si.CustId_i = c.CustId_i
        ${whereClause}
      `;
      
      const [countResult] = await db.query(countQuery, params);
      const total = countResult[0].total;
      
      // Query for invoices with pagination
      const query = `
        SELECT 
          c.CustName_v as customer_name,
          si.DocRef_v as invoice_number,
          si.TxnDate_dd as invoice_date,
          cu.CurrCode_c as currency,
          cu.CurrRate_d as currency_rate,
          CONCAT(u.UserAbbrev_v, ' ', u.UserName_v) as sales_person,
          si.DocRemark_v as notes,
          si.GrandTotal_d as total_amount,
          si.EinvuuId_v as e_invoice_uuid,
          si.EinvlongId_v as e_invoice_longid,
          si.EinvStatus_v as e_invoice_status,
          si.TxnId_i as id
        FROM tbl_sinvoice_txn si
        LEFT JOIN tbl_customer c ON si.CustId_i = c.CustId_i
        LEFT JOIN tbl_currency cu ON si.CurrId_i = cu.CurrId_i
        LEFT JOIN tbl_user u ON u.UserID_i = si.OwnerId_i
        ${whereClause}
        ORDER BY si.TxnDate_dd DESC
        LIMIT ?, ?
      `;
      
      const [invoices] = await db.query(query, [...params, offset, parseInt(limit)]);
      
      return {
        success: true,
        data: invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching sales invoices:', error);
      return {
        success: false,
        message: 'Failed to fetch sales invoices',
        error: error.message
      };
    }
  }

  /**
   * Get a sales invoice by ID including all line items
   * @param {number} id - Invoice ID
   * @returns {Promise<Object>} - Sales invoice data
   */
  static async getSalesInvoiceById(id) {
    try {
      // Get invoice header
      const query = `
        SELECT si.*, c.customer_name, c.customer_code, 
               c.address, c.email, c.phone, 
               pm.payment_term_name, sm.shipping_term_name,
               sp.shipping_policy_name
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        LEFT JOIN payment_terms pm ON si.payment_term_id = pm.id
        LEFT JOIN shipping_terms sm ON si.shipping_term_id = sm.id
        LEFT JOIN shipping_policies sp ON si.shipping_policy_id = sp.id
        WHERE si.id = ?
      `;
      
      const [invoices] = await db.query(query, [id]);
      
      if (invoices.length === 0) {
        return {
          success: false,
          message: 'Sales invoice not found'
        };
      }
      
      // Get invoice items
      const itemsQuery = `
        SELECT sii.*, p.product_name, p.product_code, u.unit_name
        FROM sales_invoice_items sii
        LEFT JOIN products p ON sii.product_id = p.id
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE sii.invoice_id = ?
      `;
      
      const [items] = await db.query(itemsQuery, [id]);
      
      // Calculate totals
      let subtotal = 0;
      items.forEach(item => {
        subtotal += parseFloat(item.line_total);
      });
      
      const invoice = invoices[0];
      invoice.items = items;
      invoice.calculated = {
        subtotal: subtotal,
        tax_amount: subtotal * (invoice.tax_rate / 100),
        grand_total: subtotal + (subtotal * (invoice.tax_rate / 100))
      };
      
      return {
        success: true,
        data: invoice
      };
    } catch (error) {
      logger.error('Error fetching sales invoice by ID:', error);
      return {
        success: false,
        message: 'Failed to fetch sales invoice',
        error: error.message
      };
    }
  }

  /**
   * Create a new sales invoice
   * @param {Object} invoiceData - Invoice header data
   * @param {Array} invoiceItems - Invoice line items
   * @returns {Promise<Object>} - Result of the operation
   */
  static async createSalesInvoice(invoiceData, invoiceItems) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Format dates
      invoiceData.invoice_date = moment(invoiceData.invoice_date).format('YYYY-MM-DD');
      invoiceData.due_date = moment(invoiceData.due_date).format('YYYY-MM-DD');
      
      // Insert invoice header
      const insertQuery = `
        INSERT INTO sales_invoices (
          invoice_number, customer_id, invoice_date, due_date,
          payment_term_id, shipping_term_id, shipping_policy_id,
          notes, tax_rate, discount_amount, status,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      const [result] = await connection.query(insertQuery, [
        invoiceData.invoice_number,
        invoiceData.customer_id,
        invoiceData.invoice_date,
        invoiceData.due_date,
        invoiceData.payment_term_id,
        invoiceData.shipping_term_id,
        invoiceData.shipping_policy_id,
        invoiceData.notes,
        invoiceData.tax_rate,
        invoiceData.discount_amount,
        invoiceData.status || 'draft',
        invoiceData.created_by
      ]);
      
      const invoiceId = result.insertId;
      
      // Insert invoice items
      const itemInsertQuery = `
        INSERT INTO sales_invoice_items (
          invoice_id, product_id, description, quantity,
          unit_price, tax_rate, discount_amount, line_total
        ) VALUES ?
      `;
      
      const itemValues = invoiceItems.map(item => [
        invoiceId,
        item.product_id,
        item.description,
        item.quantity,
        item.unit_price,
        item.tax_rate || 0,
        item.discount_amount || 0,
        item.line_total
      ]);
      
      await connection.query(itemInsertQuery, [itemValues]);
      
      await connection.commit();
      
      return {
        success: true,
        message: 'Sales invoice created successfully',
        data: { id: invoiceId }
      };
    } catch (error) {
      await connection.rollback();
      logger.error('Error creating sales invoice:', error);
      return {
        success: false,
        message: 'Failed to create sales invoice',
        error: error.message
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Update an existing sales invoice
   * @param {number} id - Invoice ID
   * @param {Object} invoiceData - Invoice header data
   * @param {Array} invoiceItems - Invoice line items
   * @returns {Promise<Object>} - Result of the operation
   */
  static async updateSalesInvoice(id, invoiceData, invoiceItems) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if record exists and get current version
      const [currentInvoice] = await connection.query(
        'SELECT version FROM sales_invoices WHERE id = ?',
        [id]
      );
      
      if (currentInvoice.length === 0) {
        return {
          success: false,
          message: 'Sales invoice not found'
        };
      }
      
      // Concurrency control
      if (currentInvoice[0].version !== invoiceData.version) {
        return {
          success: false,
          message: 'This record has been modified by another user. Please refresh and try again.'
        };
      }
      
      // Format dates
      invoiceData.invoice_date = moment(invoiceData.invoice_date).format('YYYY-MM-DD');
      invoiceData.due_date = moment(invoiceData.due_date).format('YYYY-MM-DD');
      
      // Copy to history table
      await connection.query(
        'INSERT INTO sales_invoices_history SELECT * FROM sales_invoices WHERE id = ?',
        [id]
      );
      
      // Update invoice header
      const updateQuery = `
        UPDATE sales_invoices SET
          customer_id = ?,
          invoice_date = ?,
          due_date = ?,
          payment_term_id = ?,
          shipping_term_id = ?,
          shipping_policy_id = ?,
          notes = ?,
          tax_rate = ?,
          discount_amount = ?,
          status = ?,
          updated_by = ?,
          updated_at = NOW(),
          version = version + 1
        WHERE id = ?
      `;
      
      await connection.query(updateQuery, [
        invoiceData.customer_id,
        invoiceData.invoice_date,
        invoiceData.due_date,
        invoiceData.payment_term_id,
        invoiceData.shipping_term_id,
        invoiceData.shipping_policy_id,
        invoiceData.notes,
        invoiceData.tax_rate,
        invoiceData.discount_amount,
        invoiceData.status,
        invoiceData.updated_by,
        id
      ]);
      
      // Delete existing items
      await connection.query('DELETE FROM sales_invoice_items WHERE invoice_id = ?', [id]);
      
      // Insert updated items
      const itemInsertQuery = `
        INSERT INTO sales_invoice_items (
          invoice_id, product_id, description, quantity,
          unit_price, tax_rate, discount_amount, line_total
        ) VALUES ?
      `;
      
      const itemValues = invoiceItems.map(item => [
        id,
        item.product_id,
        item.description,
        item.quantity,
        item.unit_price,
        item.tax_rate || 0,
        item.discount_amount || 0,
        item.line_total
      ]);
      
      await connection.query(itemInsertQuery, [itemValues]);
      
      await connection.commit();
      
      return {
        success: true,
        message: 'Sales invoice updated successfully'
      };
    } catch (error) {
      await connection.rollback();
      logger.error('Error updating sales invoice:', error);
      return {
        success: false,
        message: 'Failed to update sales invoice',
        error: error.message
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a sales invoice
   * @param {number} id - Invoice ID
   * @returns {Promise<Object>} - Result of the operation
   */
  static async deleteSalesInvoice(id) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Copy to history table before deletion
      await connection.query(
        'INSERT INTO sales_invoices_history SELECT * FROM sales_invoices WHERE id = ?',
        [id]
      );
      
      // Delete invoice items
      await connection.query('DELETE FROM sales_invoice_items WHERE invoice_id = ?', [id]);
      
      // Delete invoice header
      const [result] = await connection.query('DELETE FROM sales_invoices WHERE id = ?', [id]);
      
      await connection.commit();
      
      if (result.affectedRows === 0) {
        return {
          success: false,
          message: 'Sales invoice not found'
        };
      }
      
      return {
        success: true,
        message: 'Sales invoice deleted successfully'
      };
    } catch (error) {
      await connection.rollback();
      logger.error('Error deleting sales invoice:', error);
      return {
        success: false,
        message: 'Failed to delete sales invoice',
        error: error.message
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Generate a new invoice number
   * @returns {Promise<Object>} - Generated invoice number
   */
  static async generateInvoiceNumber() {
    try {
      const year = new Date().getFullYear();
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      
      // Get the last invoice number for this month
      const [result] = await db.query(
        'SELECT invoice_number FROM sales_invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1',
        [`INV-${year}${month}-%`]
      );
      
      let nextNumber = 1;
      
      if (result.length > 0) {
        const lastNumber = result[0].invoice_number.split('-')[2];
        nextNumber = parseInt(lastNumber) + 1;
      }
      
      const invoiceNumber = `INV-${year}${month}-${nextNumber.toString().padStart(4, '0')}`;
      
      return {
        success: true,
        data: { invoice_number: invoiceNumber }
      };
    } catch (error) {
      logger.error('Error generating invoice number:', error);
      return {
        success: false,
        message: 'Failed to generate invoice number',
        error: error.message
      };
    }
  }

  /**
   * Get customers for dropdown
   * @returns {Promise<Object>} - List of customers
   */
  static async getCustomers() {
    try {
      const [customers] = await db.query(
        'SELECT id, customer_name, customer_code FROM customers WHERE active = 1 ORDER BY customer_name'
      );
      
      return {
        success: true,
        data: customers
      };
    } catch (error) {
      logger.error('Error fetching customers:', error);
      return {
        success: false,
        message: 'Failed to fetch customers',
        error: error.message
      };
    }
  }

  /**
   * Get products for dropdown
   * @returns {Promise<Object>} - List of products
   */
  static async getProducts() {
    try {
      const [products] = await db.query(`
        SELECT p.id, p.product_name, p.product_code, p.unit_price, u.unit_name 
        FROM products p
        LEFT JOIN units u ON p.unit_id = u.id
        WHERE p.active = 1 
        ORDER BY p.product_name
      `);
      
      return {
        success: true,
        data: products
      };
    } catch (error) {
      logger.error('Error fetching products:', error);
      return {
        success: false,
        message: 'Failed to fetch products',
        error: error.message
      };
    }
  }

  /**
   * Get payment terms for dropdown
   * @returns {Promise<Object>} - List of payment terms
   */
  static async getPaymentTerms() {
    try {
      const [terms] = await db.query(
        'SELECT id, payment_term_name FROM payment_terms WHERE active = 1 ORDER BY payment_term_name'
      );
      
      return {
        success: true,
        data: terms
      };
    } catch (error) {
      logger.error('Error fetching payment terms:', error);
      return {
        success: false,
        message: 'Failed to fetch payment terms',
        error: error.message
      };
    }
  }

  /**
   * Get shipping terms for dropdown
   * @returns {Promise<Object>} - List of shipping terms
   */
  static async getShippingTerms() {
    try {
      const [terms] = await db.query(
        'SELECT id, shipping_term_name FROM shipping_terms WHERE active = 1 ORDER BY shipping_term_name'
      );
      
      return {
        success: true,
        data: terms
      };
    } catch (error) {
      logger.error('Error fetching shipping terms:', error);
      return {
        success: false,
        message: 'Failed to fetch shipping terms',
        error: error.message
      };
    }
  }

  /**
   * Get shipping policies for dropdown
   * @returns {Promise<Object>} - List of shipping policies
   */
  static async getShippingPolicies() {
    try {
      const [policies] = await db.query(
        'SELECT id, shipping_policy_name FROM shipping_policies WHERE active = 1 ORDER BY shipping_policy_name'
      );
      
      return {
        success: true,
        data: policies
      };
    } catch (error) {
      logger.error('Error fetching shipping policies:', error);
      return {
        success: false,
        message: 'Failed to fetch shipping policies',
        error: error.message
      };
    }
  }

  /**
   * Test database connection
   * @returns {Promise<Object>} - Connection test result
   */
  static async testConnection() {
    try {
      await db.query('SELECT 1');
      return {
        success: true,
        message: 'Database connection successful'
      };
    } catch (error) {
      logger.error('Database connection error:', error);
      return {
        success: false,
        message: 'Database connection failed',
        error: error.message
      };
    }
  }
}

module.exports = InvoicesModel;
