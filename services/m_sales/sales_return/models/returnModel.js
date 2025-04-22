const pool = require('../../../config/database');
const moment = require('moment');

/**
 * Sales Return Model - Database operations for sales returns
 */
class ReturnModel {
  /**
   * Get all sales returns with pagination and filtering
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} List of sales returns
   */
  static async getReturns(filters = {}) {
    const connection = await pool.getConnection();
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;
      
      // Start building the WHERE clause
      let whereConditions = [];
      let queryParams = [];
      
      // Add the date filter based on user selection
      if (filters.fromDate && filters.toDate) {
        // Custom date range
        whereConditions.push('sr.TxnDate_dd BETWEEN ? AND ?');
        queryParams.push(filters.fromDate, filters.toDate);
      } else if (filters.monthsBack && filters.monthsBack !== '0') {
        // Predefined period (3, 6, 12 months)
        whereConditions.push('sr.TxnDate_dd >= DATE_SUB(CURRENT_DATE, INTERVAL ? MONTH)');
        queryParams.push(parseInt(filters.monthsBack));
      }
      
      // Add status filter if provided
      if (filters.status) {
        whereConditions.push('sr._Status_c = ?');
        queryParams.push(filters.status);
      }
      
      // Add search filters
      if (filters.returnNumber) {
        whereConditions.push('sr.DocRef_v LIKE ?');
        queryParams.push(`%${filters.returnNumber}%`);
      }
      
      if (filters.customerName) {
        whereConditions.push('c.CustName_v LIKE ?');
        queryParams.push(`%${filters.customerName}%`);
      }
      
      // First check total records without joins to check for join issues
      const [baseCountRows] = await connection.execute(
        'SELECT COUNT(*) as total FROM tbl_sreturn_txn'
      );
      
      // Build the SQL query
      let sql = `
        SELECT
          sr.TxnId_i as txn_id,
          c.CustName_v as customer,
          DATE_FORMAT(sr.TxnDate_dd, '%Y-%m-%d') as doc_date,
          sr.DocRef_v as return_no,
          sr.CustRef_v as customer_ref,
          cb.CbaCity_v as branch,
          CONCAT(IFNULL(u.UserAbbrev_v, ''), ' ', IFNULL(u.UserName_v, '')) as issued_by,
          sr.DocRemark_v as remarks,
          sr._Status_c as status
        FROM tbl_sreturn_txn sr
        LEFT JOIN tbl_customer c ON c.CustId_i = sr.CustId_i
        LEFT JOIN tbl_cust_billaddr cb ON cb.CustId_i = sr.CustId_i AND cb.CbaId_i = sr.CbaId_i
        LEFT JOIN tbl_user u ON u.UserID_i = sr.OwnerId_i
      `;
      
      // Add WHERE clause if we have conditions
      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      // Add ORDER BY for document date in descending order, then txn_id
      sql += ' ORDER BY sr.TxnDate_dd DESC, sr.TxnId_i DESC';
      
      // Try to get all records without pagination to check total count
      const [allRows] = await connection.execute(
        sql + ' LIMIT 1000',
        queryParams
      );
      
      // Add pagination limit
      sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
      
      const [rows] = await connection.execute(sql, queryParams);
      
      // Get total count for pagination
      let countSql = `
        SELECT COUNT(*) as total 
        FROM tbl_sreturn_txn sr
        LEFT JOIN tbl_customer c ON c.CustId_i = sr.CustId_i
        LEFT JOIN tbl_cust_billaddr cb ON cb.CustId_i = sr.CustId_i AND cb.CbaId_i = sr.CbaId_i
        LEFT JOIN tbl_user u ON u.UserID_i = sr.OwnerId_i
      `;
      
      // Add WHERE clause to count query if we have conditions
      if (whereConditions.length > 0) {
        countSql += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      const [countRows] = await connection.execute(countSql, queryParams);
      
      return {
        success: true,
        data: rows,
        totalRecords: baseCountRows[0].total,
        filteredRecords: allRows.length,
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
   * Get sales return by ID with all details
   * @param {number} id - Sales return ID
   * @returns {Promise<Object>} Sales return details
   */
  static async getReturnById(id) {
    const connection = await pool.getConnection();
    try {
      // Get sales return header information
      const [rows] = await connection.execute(
        `SELECT 
          sr.TxnId_i as id,
          sr.TxnDate_dd as return_date,
          sr.DocRef_v as return_no,
          sr.SiteId_i as site_id,
          sr.LocId_i as location_id,
          sr.CustId_i as customer_id,
          c.CustName_v as customer_name,
          sr.CbaId_i as billing_address_id,
          sr.CctId_i as contact_id,
          sr.DocCba_v as doc_cba,
          sr.CurrId_i as currency_id,
          curr.CurrCode_c as currency_code,
          sr.CurrRate_d as currency_rate,
          sr.TaxReg_c as tax_reg,
          sr.SubTotal_d as sub_total,
          sr.TaxTotal_d as tax_total,
          sr.Rounding_d as rounding,
          sr.GrandTotal_d as grand_total,
          sr.Allocated_d as allocated,
          sr.Outstanding_d as outstanding,
          sr.DocRemark_v as doc_remark,
          sr.OwnerId_i as owner_id,
          sr.UpdateKey_i as update_key,
          sr.DocStatus_c as status
        FROM tbl_sreturn_txn sr
        LEFT JOIN tbl_customer c ON c.CustId_i = sr.CustId_i
        LEFT JOIN tbl_currency curr ON curr.CurrId_i = sr.CurrId_i
        WHERE sr.TxnId_i = ?`,
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const headerData = rows[0];
      
      // Get sales return items
      const [itemRows] = await connection.execute(
        `SELECT 
          sri.id,
          sri.txn_id,
          sri.item_id,
          sri.stk_id,
          pc.StkCode_v as stk_code,
          pc.ProdName_v as product_name,
          sri.row_id,
          sri.prow_id,
          sri.parent_id,
          sri.parent_ref,
          sri.batch,
          sri.doc_itm,
          sri.qty,
          sri.price,
          sri.discount,
          sri.discount_flag,
          sri.discount_amount,
          sri.actual_price,
          sri.tax_rate,
          sri.tax_amount,
          sri.line_total,
          sri.home_line_total,
          sri.total_tax_amount,
          sri.locked,
          m.UomCode_v as uom_code,
          h.HsCode_v as hscode_code
        FROM tbl_sales_return_item sri
        LEFT JOIN tbl_product_code pc ON pc.StkId_i = sri.stk_id
        LEFT JOIN tbl_product_master m ON m.ItemId_i = sri.item_id
        LEFT JOIN tbl_hscode h ON h.HsCodeId_i = m.HsCodeId_i
        WHERE sri.txn_id = ?
        ORDER BY sri.row_id`,
        [id]
      );
      
      // Format the response
      const salesReturn = {
        id: headerData.id,
        returnDate: headerData.return_date ? moment(headerData.return_date).format('YYYY-MM-DD') : '',
        returnNo: headerData.return_no,
        siteId: headerData.site_id,
        locationId: headerData.location_id,
        customerId: headerData.customer_id,
        customerName: headerData.customer_name,
        billingAddressId: headerData.billing_address_id,
        contactId: headerData.contact_id,
        docCba: headerData.doc_cba,
        currencyId: headerData.currency_id,
        currencyCode: headerData.currency_code || 'MYR',
        currencyRate: parseFloat(headerData.currency_rate || 1).toFixed(4),
        taxReg: headerData.tax_reg,
        subTotal: parseFloat(headerData.sub_total || 0).toFixed(2),
        taxTotal: parseFloat(headerData.tax_total || 0).toFixed(2),
        rounding: parseFloat(headerData.rounding || 0).toFixed(2),
        grandTotal: parseFloat(headerData.grand_total || 0).toFixed(2),
        allocated: parseFloat(headerData.allocated || 0).toFixed(2),
        outstanding: parseFloat(headerData.outstanding || 0).toFixed(2),
        remark: headerData.doc_remark,
        ownerId: headerData.owner_id,
        updateKey: headerData.update_key,
        status: headerData.status,
        statusText: this.getStatusText(headerData.status),
        items: itemRows.map(item => ({
          id: item.id,
          txnId: item.txn_id,
          itemId: item.item_id,
          stkId: item.stk_id,
          stkCode: item.stk_code,
          productName: item.product_name,
          rowId: item.row_id,
          prowId: item.prow_id,
          parentId: item.parent_id,
          parentRef: item.parent_ref,
          batch: item.batch,
          docItm: item.doc_itm,
          qty: parseFloat(item.qty || 0),
          price: parseFloat(item.price || 0).toFixed(2),
          discount: parseFloat(item.discount || 0).toFixed(2),
          discountFlag: item.discount_flag,
          discountAmount: parseFloat(item.discount_amount || 0).toFixed(2),
          actualPrice: parseFloat(item.actual_price || 0).toFixed(2),
          taxRate: parseFloat(item.tax_rate || 0).toFixed(2),
          taxAmount: parseFloat(item.tax_amount || 0).toFixed(2),
          lineTotal: parseFloat(item.line_total || 0).toFixed(2),
          homeLineTotal: parseFloat(item.home_line_total || 0).toFixed(2),
          totalTaxAmount: parseFloat(item.total_tax_amount || 0).toFixed(2),
          locked: item.locked,
          uomCode: item.uom_code,
          hscodeCode: item.hscode_code
        }))
      };
      
      return salesReturn;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Create a new sales return
   * @param {Object} data - Sales return data
   * @param {number} userId - User ID creating the return
   * @returns {Promise<Object>} Created sales return data
   */
  static async createReturn(data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Generate document reference if not provided
      if (!data.returnNo) {
        data.returnNo = await this.generateDocRef();
      }
      
      // Insert sales return header
      const [headerResult] = await connection.execute(
        `INSERT INTO tbl_sreturn_txn (
          TxnDate_dd,
          DocRef_v,
          SiteId_i,
          LocId_i,
          CustId_i,
          CbaId_i,
          CctId_i,
          DocCba_v,
          CurrId_i,
          CurrRate_d,
          TaxReg_c,
          SubTotal_d,
          TaxTotal_d,
          Rounding_d,
          GrandTotal_d,
          Allocated_d,
          Outstanding_d,
          DocRemark_v,
          OwnerId_i,
          DocStatus_c,
          CreateId_i,
          CreateDate_dt,
          UpdateId_i,
          UpdateDate_dt,
          UpdateKey_i
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), 1)`,
        [
          moment(data.returnDate).format('YYYY-MM-DD'),
          data.returnNo,
          data.siteId || 1,
          data.locationId || 1,
          data.customerId,
          data.billingAddressId || null,
          data.contactId || null,
          data.docCba || '',
          data.currencyId || 1, // Default to MYR
          data.currencyRate || 1,
          data.taxReg || 1,
          data.subTotal || 0,
          data.taxTotal || 0,
          data.rounding || 0,
          data.grandTotal || 0,
          data.allocated || 0,
          data.outstanding || data.grandTotal || 0,
          data.remark || '',
          data.ownerId || userId,
          data.status || 'A', // Active
          userId,
          userId
        ]
      );
      
      const returnId = headerResult.insertId;
      
      // Insert sales return items
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await connection.execute(
            `INSERT INTO tbl_sales_return_item (
              txn_id,
              item_id,
              stk_id,
              row_id,
              prow_id,
              parent_id,
              parent_ref,
              batch,
              doc_itm,
              qty,
              price,
              discount,
              discount_flag,
              discount_amount,
              actual_price,
              tax_rate,
              tax_amount,
              line_total,
              home_line_total,
              total_tax_amount,
              locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              returnId,
              item.itemId,
              item.stkId,
              item.rowId || 0,
              item.prowId || 0,
              item.parentId || null,
              item.parentRef || '',
              item.batch || '',
              item.docItm || '',
              item.qty || 0,
              item.price || 0,
              item.discount || 0,
              item.discountFlag || 0,
              item.discountAmount || 0,
              item.actualPrice || item.price || 0,
              item.taxRate || 0,
              item.taxAmount || 0,
              item.lineTotal || 0,
              item.homeLineTotal || 0,
              item.totalTaxAmount || 0,
              item.locked || 0
            ]
          );
        }
      }
      
      await connection.commit();
      
      // Return the created sales return
      return await this.getReturnById(returnId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing sales return
   * @param {number} id - Sales return ID
   * @param {Object} data - Updated sales return data
   * @param {number} userId - User ID updating the return
   * @returns {Promise<Object>} Updated sales return data
   */
  static async updateReturn(id, data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Get current update key for optimistic concurrency control
      const [keyRow] = await connection.execute(
        'SELECT UpdateKey_i FROM tbl_sreturn_txn WHERE TxnId_i = ?',
        [id]
      );
      
      if (keyRow.length === 0) {
        throw new Error('Sales Return not found');
      }
      
      const currentUpdateKey = keyRow[0].UpdateKey_i;
      const newUpdateKey = currentUpdateKey + 1;
      
      // Update sales return header
      await connection.execute(
        `UPDATE tbl_sreturn_txn SET
          TxnDate_dd = ?,
          DocRef_v = ?,
          CustId_i = ?,
          CbaId_i = ?,
          CctId_i = ?,
          DocCba_v = ?,
          CurrId_i = ?,
          CurrRate_d = ?,
          SubTotal_d = ?,
          TaxTotal_d = ?,
          Rounding_d = ?,
          GrandTotal_d = ?,
          Outstanding_d = ?,
          DocRemark_v = ?,
          OwnerId_i = ?,
          DocStatus_c = ?,
          UpdateId_i = ?,
          UpdateDate_dt = NOW(),
          UpdateKey_i = ?
        WHERE TxnId_i = ? AND UpdateKey_i = ?`,
        [
          moment(data.returnDate).format('YYYY-MM-DD'),
          data.returnNo,
          data.customerId,
          data.billingAddressId || null,
          data.contactId || null,
          data.docCba || '',
          data.currencyId || 1,
          data.currencyRate || 1,
          data.subTotal || 0,
          data.taxTotal || 0,
          data.rounding || 0,
          data.grandTotal || 0,
          data.outstanding || data.grandTotal || 0,
          data.remark || '',
          data.ownerId || userId,
          data.status || 'A',
          userId,
          newUpdateKey,
          id,
          currentUpdateKey
        ]
      );
      
      // Delete existing items
      await connection.execute(
        'DELETE FROM tbl_sales_return_item WHERE txn_id = ?',
        [id]
      );
      
      // Insert updated items
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await connection.execute(
            `INSERT INTO tbl_sales_return_item (
              txn_id,
              item_id,
              stk_id,
              row_id,
              prow_id,
              parent_id,
              parent_ref,
              batch,
              doc_itm,
              qty,
              price,
              discount,
              discount_flag,
              discount_amount,
              actual_price,
              tax_rate,
              tax_amount,
              line_total,
              home_line_total,
              total_tax_amount,
              locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              item.itemId,
              item.stkId,
              item.rowId || 0,
              item.prowId || 0,
              item.parentId || null,
              item.parentRef || '',
              item.batch || '',
              item.docItm || '',
              item.qty || 0,
              item.price || 0,
              item.discount || 0,
              item.discountFlag || 0,
              item.discountAmount || 0,
              item.actualPrice || item.price || 0,
              item.taxRate || 0,
              item.taxAmount || 0,
              item.lineTotal || 0,
              item.homeLineTotal || 0,
              item.totalTaxAmount || 0,
              item.locked || 0
            ]
          );
        }
      }
      
      await connection.commit();
      
      // Return the updated sales return
      return await this.getReturnById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Delete a sales return
   * @param {number} id - Sales return ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteReturn(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete sales return items
      await connection.execute(
        'DELETE FROM tbl_sales_return_item WHERE txn_id = ?',
        [id]
      );
      
      // Delete sales return header
      await connection.execute(
        'DELETE FROM tbl_sreturn_txn WHERE TxnId_i = ?',
        [id]
      );
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
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
          CustCode_v as code,
          ProdCode_v as product_code
        FROM tbl_customer
        WHERE Status_c = 'A'
        ORDER BY CustName_v`
      );
      
      return rows;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get products for dropdown
   * @returns {Promise<Array>} List of products
   */
  static async getProducts() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          p.ItemId_i as id,
          p.StkId_i as stk_id,
          pc.StkCode_v as code,
          pc.ProdName_v as name,
          pm.UomCode_v as uom,
          pm.SellPrice_d as price
        FROM tbl_product_master p
        LEFT JOIN tbl_product_code pc ON pc.ItemId_i = p.ItemId_i AND pc.Alias_c = '0'
        LEFT JOIN tbl_product_master pm ON pm.ItemId_i = p.ItemId_i
        WHERE p.Status_c = 'A'
        ORDER BY pc.ProdName_v`
      );
      
      return rows;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get invoices for a customer
   * @param {number} customerId - Customer ID
   * @returns {Promise<Array>} List of invoices
   */
  static async getInvoices(customerId) {
    const connection = await pool.getConnection();
    try {
      const queryParams = [];
      let whereClause = 'WHERE st.txntype_id = 47'; // Sales Invoice
      
      if (customerId) {
        whereClause += ' AND st.CustId_i = ?';
        queryParams.push(customerId);
      }
      
      const [rows] = await connection.execute(
        `SELECT 
          st.TxnId_i as id,
          st.DocRef_v as invoice_no,
          st.TxnDate_dd as invoice_date,
          c.CustName_v as customer_name,
          st.GrandTotal_d as amount
        FROM tbl_sales_txn st
        LEFT JOIN tbl_customer c ON c.CustId_i = st.CustId_i
        ${whereClause}
        ORDER BY st.TxnDate_dd DESC`,
        queryParams
      );
      
      return rows.map(row => ({
        id: row.id,
        invoiceNo: row.invoice_no,
        invoiceDate: row.invoice_date ? moment(row.invoice_date).format('YYYY-MM-DD') : '',
        customerName: row.customer_name,
        amount: parseFloat(row.amount || 0).toFixed(2)
      }));
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get deliveries for a customer
   * @param {number} customerId - Customer ID
   * @returns {Promise<Array>} List of deliveries
   */
  static async getDeliveries(customerId) {
    const connection = await pool.getConnection();
    try {
      const queryParams = [];
      let whereClause = 'WHERE st.txntype_id = 45'; // Sales Delivery
      
      if (customerId) {
        whereClause += ' AND st.CustId_i = ?';
        queryParams.push(customerId);
      }
      
      const [rows] = await connection.execute(
        `SELECT 
          st.TxnId_i as id,
          st.DocRef_v as delivery_no,
          st.TxnDate_dd as delivery_date,
          c.CustName_v as customer_name
        FROM tbl_sales_txn st
        LEFT JOIN tbl_customer c ON c.CustId_i = st.CustId_i
        ${whereClause}
        ORDER BY st.TxnDate_dd DESC`,
        queryParams
      );
      
      return rows.map(row => ({
        id: row.id,
        deliveryNo: row.delivery_no,
        deliveryDate: row.delivery_date ? moment(row.delivery_date).format('YYYY-MM-DD') : '',
        customerName: row.customer_name
      }));
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Generate a unique document reference number for sales return
   * @returns {Promise<string>} Generated reference number
   */
  static async generateDocRef() {
    const connection = await pool.getConnection();
    try {
      // Get the current year and month
      const today = new Date();
      const year = today.getFullYear().toString().substr(-2);
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      
      // Get the last return number
      const [rows] = await connection.execute(
        `SELECT DocRef_v 
         FROM tbl_sreturn_txn 
         ORDER BY TxnId_i DESC
         LIMIT 1`
      );
      
      let nextNum = 1;
      
      if (rows.length > 0) {
        const lastRef = rows[0].DocRef_v;
        const lastNum = parseInt(lastRef.substring(6), 10) || 0;
        nextNum = lastNum + 1;
      }
      
      // Format the new reference number
      return `SR${year}${month}${nextNum.toString().padStart(4, '0')}`;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get status text for status code
   * @param {string} statusCode - Status code
   * @returns {string} Status text
   */
  static getStatusText(statusCode) {
    switch (statusCode) {
      case 'A':
        return 'Active';
      case 'C':
        return 'Completed';
      case 'V':
        return 'Void';
      case 'D':
        return 'Draft';
      case 'P':
        return 'Pending';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Test database connection
   */
  static async testConnection() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT 1');
      return rows;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ReturnModel;
