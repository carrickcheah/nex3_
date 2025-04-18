const pool = require('../../../config/database');
const moment = require('moment');

/**
 * Sales Delivery Instruction Model - Database operations for SDI
 */
class InstructionModel {
  /**
   * Get all delivery instructions with pagination and filtering
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} List of delivery instructions
   */
  static async getDeliveryInstructions(filters = {}) {
    const connection = await pool.getConnection();
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      
      const searchTerms = [];
      const queryParams = [];
      
      let sql = `
        SELECT 
          s.SdiId_i as id,
          s.ImportId_i as import_id,
          c.CustName_v as customerName,
          s.Reference_v as po_no,
          s.RefStkcode_v as stock_code,
          s.DiNo_v as di_no,
          s.Shift_v as shift,
          s.Zone_v as zone,
          s.Location_v as location,
          s.Dept_v as dept,
          s.Line_v as line,
          s.Qty_d as di_qty,
          s.EtaDate_dd as eta_date,
          s.QtyDone_d as do_qty,
          s.Remark_v as remark,
          s.Status_c as status
        FROM tbl_sdi_item s
        LEFT JOIN tbl_customer c ON c.CustId_i = s.CustId_i
      `;
      
      // Add search filters
      if (filters.docRef) {
        searchTerms.push('s.DiNo_v LIKE ?');
        queryParams.push(`%${filters.docRef}%`);
      }
      
      if (filters.customerName) {
        searchTerms.push('c.CustName_v LIKE ?');
        queryParams.push(`%${filters.customerName}%`);
      }
      
      if (filters.status) {
        searchTerms.push('s.Status_c = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.fromDate) {
        searchTerms.push('s.EtaDate_dd >= ?');
        queryParams.push(moment(filters.fromDate, 'DD-MM-YYYY').format('YYYY-MM-DD'));
      }
      
      if (filters.toDate) {
        searchTerms.push('s.EtaDate_dd <= ?');
        queryParams.push(moment(filters.toDate, 'DD-MM-YYYY').format('YYYY-MM-DD'));
      }
      
      if (searchTerms.length > 0) {
        sql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      // Always add sorting for consistent results
      sql += ` ORDER BY s.SdiId_i DESC`;
      
      // Add pagination
      sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      
      console.log('Executing SQL query:', sql);
      console.log('With parameters:', queryParams);

      const [rows] = await connection.execute(sql, queryParams);
      
      // Get total count for pagination
      let countSql = `
        SELECT COUNT(*) as total 
        FROM tbl_sdi_item s
        LEFT JOIN tbl_customer c ON c.CustId_i = s.CustId_i
      `;
      
      if (searchTerms.length > 0) {
        countSql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      const [countRows] = await connection.execute(countSql, queryParams);
      
      return {
        instructions: rows.map(row => ({
          ...row,
          importId: row.import_id,
          poNo: row.po_no,
          stockCode: row.stock_code,
          diNo: row.di_no,
          department: row.dept,
          diQty: parseFloat(row.di_qty || 0),
          etaDate: row.eta_date ? moment(row.eta_date).format('DD-MM-YYYY') : '',
          doQty: parseFloat(row.do_qty || 0),
          statusText: this.getStatusText(row.status)
        })),
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRows[0].total / limit)
      };
    } catch (error) {
      console.error('Error in getDeliveryInstructions:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get delivery instruction by ID with all details
   * @param {number} id - Delivery instruction ID
   * @returns {Promise<Object>} Delivery instruction details
   */
  static async getDeliveryInstructionById(id) {
    const connection = await pool.getConnection();
    try {
      // Get delivery instruction with customer and address information
      const [rows] = await connection.execute(
        `SELECT 
          s.SdiId_i as id,
          s.ImportId_i as import_id,
          s.Reference_v as purchase_order_no,
          s.CreateDate_dt as transaction_date,
          c.CustName_v as customerName,
          c.CustId_i as customerId,
          s.EtaDate_dd as eta_date,
          s.CreateId_i as create_by,
          
          CONCAT(ccc.CbaAddr1_v, ' ', ccc.CbaAddr2_v, ' ', ccc.CbaCity_v, ' ', ccc.CbaPostcode_v) as delivery_address,
          
          s.Remark_v as remark,
          
          s.RefStkcode_v as stock_code,
          s.Line_v as line,
          s.Dept_v as dept,
          s.Qty_d as do_qty,
          s.QtyDone_d as qty_done,
          s.Status_c as status
        FROM tbl_sdi_item s
        LEFT JOIN tbl_customer c ON c.CustId_i = s.CustId_i
        LEFT JOIN tbl_cust_billaddr ccc ON ccc.CustId_i = s.CustId_i
        WHERE s.SdiId_i = ?`,
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const row = rows[0];
      
      const instruction = {
        id: id,
        docRef: row.purchase_order_no,
        txnDate: row.transaction_date ? moment(row.transaction_date).format('DD-MM-YYYY') : '',
        customerId: row.customerId,
        customerName: row.customerName,
        deliveryDate: row.eta_date ? moment(row.eta_date).format('DD-MM-YYYY') : '',
        importId: row.import_id || '',
        createdById: row.create_by,
        deliveryAddress: row.delivery_address,
        remark: row.remark,
        stockCode: row.stock_code,
        line: row.line,
        department: row.dept,
        diQty: parseFloat(row.do_qty || 0),
        doQty: parseFloat(row.qty_done || 0),
        status: row.status,
        statusText: this.getStatusText(row.status),
        // Add a basic item structure for display in the items table
        items: [{
          rowId: 1,
          itemId: id,
          productCode: row.stock_code,
          productName: row.stock_code, // Use stock_code as product name if not available
          quantity: parseFloat(row.do_qty || 0),
          uom: '',
          etaDate: row.eta_date ? moment(row.eta_date).format('DD-MM-YYYY') : '',
          remark: row.remark,
          balance: parseFloat(row.do_qty || 0) - parseFloat(row.qty_done || 0),
          quantityDelivered: parseFloat(row.qty_done || 0),
          status: row.status
        }]
      };
      
      return instruction;
    } catch (error) {
      console.error('Error in getDeliveryInstructionById:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Create a new delivery instruction
   * @param {Object} data - Delivery instruction data
   * @param {number} userId - User ID creating the instruction
   * @returns {Promise<Object>} Created instruction with ID
   */
  static async createDeliveryInstruction(data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Convert date format from DD-MM-YYYY to YYYY-MM-DD for database
      const etaDate = data.etaDate ? moment(data.etaDate, 'DD-MM-YYYY').format('YYYY-MM-DD') : null;
      
      // Insert instruction
      const [result] = await connection.execute(
        `INSERT INTO tbl_sdi_item (
          CustId_i, ImportId_i, Reference_v, RefStkcode_v, DiNo_v, 
          Shift_v, Zone_v, Location_v, Dept_v, Line_v, 
          Qty_d, EtaDate_dd, QtyDone_d, Remark_v, Status_c
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.customerId,
          data.importId || null,
          data.poNo || '',
          data.stockCode || '',
          data.diNo || '',
          data.shift || '',
          data.zone || '',
          data.location || '',
          data.department || '',
          data.line || '',
          data.diQty || 0,
          etaDate,
          data.doQty || 0,
          data.remark || '',
          'P' // Default status is Pending
        ]
      );
      
      const instructionId = result.insertId;
      
      await connection.commit();
      
      return {
        id: instructionId,
        docRef: data.diNo,
        message: 'Delivery instruction created successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in createDeliveryInstruction:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing delivery instruction
   * @param {number} id - Delivery instruction ID
   * @param {Object} data - Updated delivery instruction data
   * @param {number} userId - User ID updating the instruction
   * @returns {Promise<Object>} Result of the update operation
   */
  static async updateDeliveryInstruction(id, data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Convert date format from DD-MM-YYYY to YYYY-MM-DD for database
      const etaDate = data.etaDate ? moment(data.etaDate, 'DD-MM-YYYY').format('YYYY-MM-DD') : null;
      
      // Update instruction
      await connection.execute(
        `UPDATE tbl_sdi_item SET
          CustId_i = ?, ImportId_i = ?, Reference_v = ?, RefStkcode_v = ?, DiNo_v = ?, 
          Shift_v = ?, Zone_v = ?, Location_v = ?, Dept_v = ?, Line_v = ?, 
          Qty_d = ?, EtaDate_dd = ?, QtyDone_d = ?, Remark_v = ?
        WHERE SdiId_i = ?`,
        [
          data.customerId,
          data.importId || null,
          data.poNo || '',
          data.stockCode || '',
          data.diNo || '',
          data.shift || '',
          data.zone || '',
          data.location || '',
          data.department || '',
          data.line || '',
          data.diQty || 0,
          etaDate,
          data.doQty || 0,
          data.remark || '',
          id
        ]
      );
      
      await connection.commit();
      
      return {
        id: id,
        message: 'Delivery instruction updated successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in updateDeliveryInstruction:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get customers for dropdown
   * @returns {Promise<Array>} List of customers
   */
  static async getCustomers() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          CustId_i as id, 
          CustName_v as name,
          Intid_v as code
        FROM tbl_customer
        WHERE Status_i = 1
        ORDER BY CustName_v`
      );
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get products for delivery instruction
   * @returns {Promise<Array>} List of products
   */
  static async getProducts() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          p.ItemId_i as itemId,
          p.StkId_i as stockId,
          p.StkCode_v as code,
          p.ProdName_v as name,
          p.UomId_i as uomId,
          u.UomCode_v as uom
        FROM tbl_product_code p
        LEFT JOIN tbl_uom u ON u.UomId_i = p.UomId_i
        WHERE p.Alias_c = '0' AND p.Status_i = 1
        ORDER BY p.StkCode_v`
      );
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Generate a new document reference number
   * @returns {Promise<string>} New document reference
   */
  static async generateDocRef() {
    const connection = await pool.getConnection();
    try {
      const prefix = 'DI';
      const date = moment().format('YYYYMMDD');
      
      // Get the last document number for today
      const [rows] = await connection.execute(
        `SELECT DiNo_v FROM tbl_sdi_item 
         WHERE DiNo_v LIKE ? 
         ORDER BY SdiId_i DESC LIMIT 1`,
        [`${prefix}/${date}/%`]
      );
      
      let seq = 1;
      if (rows.length > 0) {
        // Extract sequence number from last document
        const lastRef = rows[0].DiNo_v;
        const lastSeq = parseInt(lastRef.split('/')[2], 10);
        seq = lastSeq + 1;
      }
      
      // Format sequence as 4 digits
      const seqPadded = seq.toString().padStart(4, '0');
      return `${prefix}/${date}/${seqPadded}`;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get status text for a delivery instruction status code
   * @param {string} statusCode - Status code
   * @returns {string} Status text
   */
  static getStatusText(statusCode) {
    const statusMap = {
      'P': 'Pending',
      'C': 'Completed',
      'V': 'Voided',
      'X': 'Cancelled'
    };
    
    return statusMap[statusCode] || statusCode;
  }
  
  /**
   * Get status text for a delivery instruction item status code
   * @param {string} statusCode - Status code
   * @returns {string} Status text
   */
  static getItemStatusText(statusCode) {
    const statusMap = {
      'P': 'Pending',
      'C': 'Completed',
      'V': 'Voided'
    };
    
    return statusMap[statusCode] || statusCode;
  }
}

module.exports = InstructionModel;
