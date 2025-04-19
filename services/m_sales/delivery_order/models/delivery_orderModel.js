const pool = require('../../../config/database');
const moment = require('moment');

/**
 * Delivery Order Model - Database operations for delivery orders
 */
class DeliveryOrderModel {
  /**
   * Get all delivery orders with pagination and filtering
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} List of delivery orders
   */
  static async getDeliveryOrders(filters = {}) {
    const connection = await pool.getConnection();
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;
      
      const searchTerms = [];
      const queryParams = [];
      
      let sql = `
        SELECT 
          do.TxnId_i as id,
          c.CustName_v as customer_name,
          do.TxnDate_dd as doc_date,
          do.DocRef_v as do_no,
          cc.CbaLocname_v as branch,
          dd.CurrCode_c as currency,
          dd.CurrRate_d as currency_rate,
          do.GrandTotal_d as grand_total,
          do.DocStatus_c as status
        FROM tbl_sdelivery_txn do
        LEFT JOIN tbl_customer c ON c.CustId_i = do.CustId_i
        LEFT JOIN tbl_cust_billaddr cc ON cc.CustId_i = do.CustId_i
        LEFT JOIN tbl_currency dd ON dd.CurrId_i = do.CurrId_i
      `;
      
      // Add search filters
      if (filters.doNumber) {
        searchTerms.push('do.DocRef_v LIKE ?');
        queryParams.push(`%${filters.doNumber}%`);
      }
      
      if (filters.customerName) {
        searchTerms.push('c.CustName_v LIKE ?');
        queryParams.push(`%${filters.customerName}%`);
      }
      
      if (filters.status) {
        searchTerms.push('do.DocStatus_c = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.fromDate) {
        searchTerms.push('do.TxnDate_dd >= ?');
        queryParams.push(moment(filters.fromDate, 'DD-MM-YYYY').format('YYYY-MM-DD'));
      }
      
      if (filters.toDate) {
        searchTerms.push('do.TxnDate_dd <= ?');
        queryParams.push(moment(filters.toDate, 'DD-MM-YYYY').format('YYYY-MM-DD'));
      }
      
      if (searchTerms.length > 0) {
        sql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      // Add ORDER BY for document date in descending order
      sql += ' ORDER BY do.TxnDate_dd DESC';
      
      // Add pagination limit
      sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [rows] = await connection.execute(sql, queryParams);
      
      // Get total count for pagination
      let countSql = `
        SELECT COUNT(*) as total 
        FROM tbl_sdelivery_txn do
        LEFT JOIN tbl_customer c ON c.CustId_i = do.CustId_i
        LEFT JOIN tbl_cust_billaddr cc ON cc.CustId_i = do.CustId_i
        LEFT JOIN tbl_currency dd ON dd.CurrId_i = do.CurrId_i
      `;
      
      if (searchTerms.length > 0) {
        countSql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      const [countRows] = await connection.execute(countSql, queryParams);
      
      return {
        success: true,
        data: rows.map(row => ({
          id: row.id,
          customerName: row.customer_name,
          doDate: row.doc_date ? moment(row.doc_date).format('DD-MM-YYYY') : '',
          doNumber: row.do_no,
          branch: row.branch || '-',
          currency: row.currency || 'MYR',
          currRate: parseFloat(row.currency_rate || 1).toFixed(4),
          total: parseFloat(row.grand_total || 0).toFixed(2),
          status: row.status,
          statusText: this.getStatusText(row.status)
        })),
        pagination: {
          total: countRows[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countRows[0].total / limit)
        }
      };
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get delivery order by ID with all details
   * @param {number} id - Delivery order ID
   * @returns {Promise<Object>} Delivery order details
   */
  static async getDeliveryOrderById(id) {
    const connection = await pool.getConnection();
    try {
      // Get delivery order header information
      const [rows] = await connection.execute(
        `SELECT 
          do.DOId_i as id,
          do.DONo_v as do_number,
          do.SONo_v as so_number,
          do.PONo_v as po_number,
          do.DODate_dd as do_date,
          do.DeliveryDate_dd as delivery_date,
          c.CustId_i as customer_id,
          c.CustName_v as customer_name,
          CONCAT(ca.CbaAddr1_v, ' ', ca.CbaAddr2_v, ' ', ca.CbaCity_v, ' ', ca.CbaPostcode_v) as delivery_address,
          do.OutstandQty_d as outstand_qty,
          do.Completed_d as completed_qty,
          do.Balance_d as balance_qty,
          do.Remark_v as remark,
          do.Status_c as status,
          do.CreateId_i as created_by,
          do.CreateDate_dt as created_date,
          do.ModId_i as modified_by,
          do.ModDate_dt as modified_date
        FROM tbl_delivery_order do
        LEFT JOIN tbl_customer c ON c.CustId_i = do.CustId_i
        LEFT JOIN tbl_cust_billaddr ca ON ca.CustId_i = do.CustId_i
        WHERE do.DOId_i = ?`,
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const headerData = rows[0];
      
      // Get delivery order items
      const [itemRows] = await connection.execute(
        `SELECT 
          doi.DOItemId_i as id,
          doi.DOId_i as do_id,
          doi.ProdId_i as product_id,
          p.ProdName_v as product_name,
          p.ProdCode_v as product_code,
          doi.Qty_d as quantity,
          doi.UOM_v as uom,
          doi.Remark_v as remark,
          doi.Status_c as status
        FROM tbl_delivery_order_item doi
        LEFT JOIN tbl_product p ON p.ProdId_i = doi.ProdId_i
        WHERE doi.DOId_i = ?`,
        [id]
      );
      
      // Format the response
      const deliveryOrder = {
        id: headerData.id,
        doNumber: headerData.do_number,
        soNumber: headerData.so_number,
        poNumber: headerData.po_number,
        doDate: headerData.do_date ? moment(headerData.do_date).format('DD-MM-YYYY') : '',
        deliveryDate: headerData.delivery_date ? moment(headerData.delivery_date).format('DD-MM-YYYY') : '',
        customerId: headerData.customer_id,
        customerName: headerData.customer_name,
        deliveryAddress: headerData.delivery_address,
        outstandQty: parseFloat(headerData.outstand_qty || 0),
        completedQty: parseFloat(headerData.completed_qty || 0),
        balanceQty: parseFloat(headerData.balance_qty || 0),
        remark: headerData.remark,
        status: headerData.status,
        statusText: this.getStatusText(headerData.status),
        createdBy: headerData.created_by,
        createdDate: headerData.created_date ? moment(headerData.created_date).format('DD-MM-YYYY HH:mm:ss') : '',
        modifiedBy: headerData.modified_by,
        modifiedDate: headerData.modified_date ? moment(headerData.modified_date).format('DD-MM-YYYY HH:mm:ss') : '',
        items: itemRows.map((item, index) => ({
          id: item.id,
          doId: item.do_id,
          rowId: index + 1,
          productId: item.product_id,
          productName: item.product_name,
          productCode: item.product_code,
          quantity: parseFloat(item.quantity || 0),
          uom: item.uom,
          remark: item.remark,
          status: item.status,
          statusText: this.getItemStatusText(item.status)
        }))
      };
      
      return deliveryOrder;
    } catch (error) {
      console.error('Error in getDeliveryOrderById:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Create a new delivery order
   * @param {Object} data - Delivery order data
   * @param {number} userId - User ID creating the order
   * @returns {Promise<Object>} Created order with ID
   */
  static async createDeliveryOrder(data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Convert date format from DD-MM-YYYY to YYYY-MM-DD for database
      const doDate = data.doDate ? moment(data.doDate, 'DD-MM-YYYY').format('YYYY-MM-DD') : null;
      const deliveryDate = data.deliveryDate ? moment(data.deliveryDate, 'DD-MM-YYYY').format('YYYY-MM-DD') : null;
      
      // Generate unique DO number
      const doNumber = await this.generateDocRef();
      
      // Calculate totals
      const totalQty = data.items ? data.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) : 0;
      
      // Insert delivery order header
      const [headerResult] = await connection.execute(
        `INSERT INTO tbl_delivery_order (
          DONo_v, SONo_v, PONo_v, CustId_i, DODate_dd, DeliveryDate_dd,
          OutstandQty_d, Completed_d, Balance_d, Remark_v, Status_c,
          CreateId_i, CreateDate_dt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          doNumber,
          data.soNumber || '',
          data.poNumber || '',
          data.customerId,
          doDate,
          deliveryDate,
          totalQty,
          0, // Completed quantity starts at 0
          totalQty, // Balance = OutstandQty - Completed
          data.remark || '',
          'DF', // Default status is DRAFT
          userId
        ]
      );
      
      const doId = headerResult.insertId;
      
      // Insert delivery order items
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await connection.execute(
            `INSERT INTO tbl_delivery_order_item (
              DOId_i, ProdId_i, Qty_d, UOM_v, Remark_v, Status_c
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              doId,
              item.productId,
              parseFloat(item.quantity || 0),
              item.uom || '',
              item.remark || '',
              'DF' // Default status is DRAFT
            ]
          );
        }
      }
      
      await connection.commit();
      
      return {
        id: doId,
        doNumber
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in createDeliveryOrder:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing delivery order
   * @param {number} id - Delivery order ID
   * @param {Object} data - Updated delivery order data
   * @param {number} userId - User ID updating the order
   * @returns {Promise<Object>} Updated order
   */
  static async updateDeliveryOrder(id, data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Convert date format from DD-MM-YYYY to YYYY-MM-DD for database
      const doDate = data.doDate ? moment(data.doDate, 'DD-MM-YYYY').format('YYYY-MM-DD') : null;
      const deliveryDate = data.deliveryDate ? moment(data.deliveryDate, 'DD-MM-YYYY').format('YYYY-MM-DD') : null;
      
      // Calculate totals
      const totalQty = data.items ? data.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0) : 0;
      const completedQty = parseFloat(data.completedQty || 0);
      const balanceQty = totalQty - completedQty;
      
      // Check for concurrency control
      const [checkResult] = await connection.execute(
        `SELECT ModDate_dt FROM tbl_delivery_order WHERE DOId_i = ?`,
        [id]
      );
      
      if (checkResult.length === 0) {
        throw new Error('Delivery Order not found');
      }
      
      // Update delivery order header
      await connection.execute(
        `UPDATE tbl_delivery_order SET
          SONo_v = ?,
          PONo_v = ?,
          CustId_i = ?,
          DODate_dd = ?,
          DeliveryDate_dd = ?,
          OutstandQty_d = ?,
          Completed_d = ?,
          Balance_d = ?,
          Remark_v = ?,
          Status_c = ?,
          ModId_i = ?,
          ModDate_dt = NOW()
        WHERE DOId_i = ?`,
        [
          data.soNumber || '',
          data.poNumber || '',
          data.customerId,
          doDate,
          deliveryDate,
          totalQty,
          completedQty,
          balanceQty,
          data.remark || '',
          data.status || 'DF', // Default to DRAFT if not specified
          userId,
          id
        ]
      );
      
      // Delete existing items and re-insert
      await connection.execute(
        `DELETE FROM tbl_delivery_order_item WHERE DOId_i = ?`,
        [id]
      );
      
      // Insert updated items
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await connection.execute(
            `INSERT INTO tbl_delivery_order_item (
              DOId_i, ProdId_i, Qty_d, UOM_v, Remark_v, Status_c
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id,
              item.productId,
              parseFloat(item.quantity || 0),
              item.uom || '',
              item.remark || '',
              item.status || 'DF' // Default to DRAFT if not specified
            ]
          );
        }
      }
      
      await connection.commit();
      
      // Get the updated delivery order
      const updatedOrder = await this.getDeliveryOrderById(id);
      
      return updatedOrder;
    } catch (error) {
      await connection.rollback();
      console.error('Error in updateDeliveryOrder:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get all customers for dropdown
   * @returns {Promise<Array>} List of customers
   */
  static async getCustomers() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          CustId_i as id,
          CustName_v as name,
          CustCode_v as code
        FROM tbl_customer
        WHERE Status_c = 'A'
        ORDER BY CustName_v`
      );
      
      return rows;
    } catch (error) {
      console.error('Error in getCustomers:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get all products for dropdown
   * @returns {Promise<Array>} List of products
   */
  static async getProducts() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          ProdId_i as id,
          ProdName_v as name,
          ProdCode_v as code,
          UOM_v as uom
        FROM tbl_product
        WHERE Status_c = 'A'
        ORDER BY ProdName_v`
      );
      
      return rows;
    } catch (error) {
      console.error('Error in getProducts:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Generate a unique document reference number
   * @returns {Promise<string>} Generated document reference
   */
  static async generateDocRef() {
    const connection = await pool.getConnection();
    try {
      // Get current date in YYYYMMDD format
      const datePrefix = moment().format('YYYYMMDD');
      
      // Get the latest DO number with the date prefix
      const [rows] = await connection.execute(
        `SELECT DONo_v
        FROM tbl_delivery_order
        WHERE DONo_v LIKE ?
        ORDER BY DOId_i DESC
        LIMIT 1`,
        [`DO${datePrefix}%`]
      );
      
      let sequence = 1;
      
      if (rows.length > 0) {
        // Extract the sequence number from the latest DO number
        const latestDONo = rows[0].DONo_v;
        const latestSequence = parseInt(latestDONo.substring(10), 10);
        
        if (!isNaN(latestSequence)) {
          sequence = latestSequence + 1;
        }
      }
      
      // Generate new DO number with 4-digit sequence
      return `DO${datePrefix}${sequence.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error in generateDocRef:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Convert status code to readable text
   * @param {string} statusCode - Status code
   * @returns {string} Status text
   */
  static getStatusText(statusCode) {
    switch (statusCode) {
      case 'DF':
        return 'DRAFT';
      case 'UB':
        return 'UN-BILL';
      case 'P':
        return 'PARTIAL';
      case 'BL':
        return 'INVOICED';
      case 'V':
        return 'VOIDED';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Convert item status code to readable text
   * @param {string} statusCode - Status code
   * @returns {string} Status text
   */
  static getItemStatusText(statusCode) {
    switch (statusCode) {
      case 'DF':
        return 'DRAFT';
      case 'UB':
        return 'UN-BILL';
      case 'P':
        return 'PARTIAL';
      case 'BL':
        return 'INVOICED';
      case 'V':
        return 'VOIDED';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Test database connection
   * @returns {Promise<boolean>} Connection status
   */
  static async testConnection() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT 1 as connection_test');
      return rows[0].connection_test === 1;
    } catch (error) {
      console.error('Error testing database connection:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = DeliveryOrderModel;
