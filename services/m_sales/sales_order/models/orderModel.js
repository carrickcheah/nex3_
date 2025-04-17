const pool = require('../../../config/database');
const moment = require('moment');

/**
 * Sales Order Model - Database operations for sales orders
 */
class OrderModel {
  /**
   * Get all sales orders with pagination and filtering
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} List of sales orders
   */
  static async getSalesOrders(filters = {}) {
    const connection = await pool.getConnection();
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      
      const searchTerms = [];
      const queryParams = [];
      
      let sql = `
        SELECT 
          s.TxnId_i as id, 
          IFNULL(s.ImportId_i, 0) as importId,
          s.DocRef_v as docRef, 
          s.TxnDate_dd as txnDate,
          s.CustRef_v as poNo,
          s.CurrId_i as currencyId,
          s.DocStatus_c as status,
          c.CustName_v as customerName,
          s.StermId_i as shippingTermId,
          u.UserName_v as salesPersonName,
          u.UserAbbrev_v as salesPersonId,
          COALESCE(s.GrandTotal_d, 0) as grandTotal,
          cu.CurrCode_c as currencyCode
        FROM tbl_sorder_txn s 
        LEFT JOIN tbl_customer c ON c.CustId_i = s.CustId_i
        LEFT JOIN tbl_currency cu ON cu.CurrId_i = s.CurrId_i
        LEFT JOIN tbl_user u ON u.UserId_i = s.OwnerId_i
      `;
      
      // Add search filters with proper WHERE clause
      if (filters.docRef) {
        searchTerms.push('s.DocRef_v LIKE ?');
        queryParams.push(`%${filters.docRef}%`);
      }
      
      if (filters.customerName) {
        searchTerms.push('c.CustName_v LIKE ?');
        queryParams.push(`%${filters.customerName}%`);
      }
      
      if (filters.status) {
        searchTerms.push('s.DocStatus_c = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.fromDate) {
        searchTerms.push('s.TxnDate_dd >= ?');
        queryParams.push(moment(filters.fromDate, 'DD-MM-YYYY').format('YYYY-MM-DD'));
      }
      
      if (filters.toDate) {
        searchTerms.push('s.TxnDate_dd <= ?');
        queryParams.push(moment(filters.toDate, 'DD-MM-YYYY').format('YYYY-MM-DD'));
      }
      
      if (searchTerms.length > 0) {
        sql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      // Always add sorting for consistent results
      sql += ` ORDER BY s.TxnId_i DESC`;
      
      // Add pagination with a maximum of 50 records
      const effectiveLimit = Math.min(parseInt(limit), 50);
      sql += ` LIMIT ${effectiveLimit} OFFSET ${parseInt(offset)}`;
      
      console.log('Executing SQL query:', sql);
      console.log('With parameters:', queryParams);

      try {
        const [rows] = await connection.execute(sql, queryParams);
        
        // Get total count for pagination - but limit to counting max 500 records
        let countSql = `
          SELECT COUNT(*) as total 
          FROM tbl_sorder_txn s
          LEFT JOIN tbl_customer c ON c.CustId_i = s.CustId_i
          LEFT JOIN tbl_currency cu ON cu.CurrId_i = s.CurrId_i
          LEFT JOIN tbl_user u ON u.UserId_i = s.OwnerId_i
        `;
        
        if (searchTerms.length > 0) {
          countSql += ' WHERE ' + searchTerms.join(' AND ');
        }
        
        countSql += ' LIMIT 500';
        
        const [countRows] = await connection.execute(countSql, queryParams.slice(0, searchTerms.length));
        
        return {
          orders: rows,
          total: Math.min(countRows[0].total, 500), // Cap at 500 for UI performance
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(Math.min(countRows[0].total, 500) / limit)
        };
      } catch (sqlError) {
        console.error('SQL Error in getSalesOrders:', sqlError);
        console.error('Failed SQL:', sql);
        throw sqlError;
      }
    } catch (error) {
      console.error('Error in getSalesOrders:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get a sales order by ID with all details
   * @param {number} orderId - Sales order ID
   * @returns {Promise<Object>} Sales order details
   */
  static async getSalesOrderById(orderId) {
    const connection = await pool.getConnection();
    try {
      // Get order header information - matching PHP query
      const [orderRows] = await connection.execute(
        `SELECT 
          s.*, 
          c.CustName_v as customerName, 
          c.ProdCode_v as prodCode,
          u.UserName_v as salesPersonName,
          u.UserAbbrev_v as salesPersonId
        FROM tbl_sorder_txn s 
        LEFT JOIN tbl_customer c ON c.CustId_i = s.CustId_i
        LEFT JOIN tbl_user u ON u.UserId_i = s.OwnerId_i
        WHERE s.TxnId_i = ? AND s.TxnTypeId_i = 43`,
        [orderId]
      );
      
      if (orderRows.length === 0) {
        return null;
      }
      
      const order = {
        id: orderRows[0].TxnId_i,
        importId: orderRows[0].ImportId_i !== null ? orderRows[0].ImportId_i : 0,
        siteId: orderRows[0].SiteId_i,
        locId: orderRows[0].LocId_i,
        customerId: orderRows[0].CustId_i,
        customerName: orderRows[0].customerName,
        docRef: orderRows[0].DocRef_v,
        custRef: orderRows[0].CustRef_v,
        txnDate: moment(orderRows[0].TxnDate_dd).format('DD-MM-YYYY'),
        expiryDate: moment(orderRows[0].ExpDate_dd).format('DD-MM-YYYY'),
        paymentTermId: orderRows[0].PtermId_i,
        currencyId: orderRows[0].CurrId_i,
        currencyRate: orderRows[0].CurrRate_d,
        shippingTermId: orderRows[0].StermId_i,
        shippingPolicyId: orderRows[0].SpolicyId_i,
        billingAddressId: orderRows[0].CbaId_i,
        shippingAddressId: orderRows[0].CsaId_i,
        docBillingAddress: orderRows[0].DocCba_v,
        docShippingAddress: orderRows[0].DocCsa_v,
        billingContact: orderRows[0].CbaContact_v,
        subTotal: orderRows[0].SubTotal_d,
        taxTotal: orderRows[0].TaxTotal_d,
        rounding: orderRows[0].Rounding_d,
        grandTotal: orderRows[0].GrandTotal_d,
        allocated: orderRows[0].Allocated_d,
        outstanding: orderRows[0].Outstanding_d,
        remark: orderRows[0].DocRemark_v,
        ownerId: orderRows[0].OwnerId_i,
        salesPersonName: orderRows[0].salesPersonName,
        salesPersonId: orderRows[0].salesPersonId,
        salesPerson: orderRows[0].salesPersonId && orderRows[0].salesPersonName ? 
                      `${orderRows[0].salesPersonId} ${orderRows[0].salesPersonName}` : 
                      (orderRows[0].salesPersonName || ''),
        status: orderRows[0].DocStatus_c,
        updateKey: orderRows[0].UpdateKey_i
      };
      
      // Get order items - matching PHP query
      const [itemRows] = await connection.execute(
        `SELECT 
          s.*, t.DocRef_v as parent_ref, p.StkCode_v as stk_code, 
          c.StkCode_v AS stock_sku, 
          c.ProdName_v AS stock_name,			
          u.StkCode_v as stk_code, u.ProdName_v as prod_name, 
          u.StockDescr_v as stock_descr, u.UomCode_v, u.HscodeCode_v as hscode_code
        FROM tbl_sorder_item s 
        LEFT JOIN tbl_sorder_txn t ON t.TxnId_i = s.ParentId_i
        LEFT JOIN tbl_product_code p ON p.StkId_i = s.StkId_i
        LEFT JOIN tbl_product_code c ON c.ItemId_i = s.ItemId_i AND c.Alias_c='0'
        LEFT JOIN tbl_product_master m ON m.ItemId_i = s.ItemId_i
        LEFT JOIN tbl_doc_itm u ON u.DocItm_i = s.DocItm_i
        WHERE s.TxnId_i = ? ORDER BY s.Id_i`,
        [orderId]
      );
      
      // Transform item rows to match expected format
      order.items = itemRows.map(item => ({
        rowId: item.RowId_i,
        stockId: item.StkId_i,
        itemId: item.ItemId_i,
        parentId: item.ParentId_i || 0,
        itemDescription: item.DocItm_i || '',
        quantity: item.Qty_d,
        quantityDelivered: item.QtyDone_d || 0,
        unitPrice: item.Price_d,
        discount: item.Discount_d || 0,
        discountType: item.DiscountFlag_c || 'P',
        discountAmount: item.DiscountAmount_d || 0,
        actualPrice: item.ActualPrice_d || 0,
        lineAmount: item.LineTotal_d || 0,
        productCode: item.stock_sku || '',
        productDescription: item.stock_name || '',
        uom: item.UomCode_v || ''
      }));
      
      return order;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Create a new sales order
   * @param {Object} orderData - Sales order data
   * @param {number} userId - User ID creating the order
   * @returns {Promise<Object>} Created order with ID
   */
  static async createSalesOrder(orderData, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Convert date format from DD-MM-YYYY to YYYY-MM-DD for database
      const txnDate = moment(orderData.txnDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
      const expiryDate = moment(orderData.expiryDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
      
      // Insert order header - matching PHP implementation
      const [result] = await connection.execute(
        `INSERT INTO tbl_sorder_txn (
          SiteId_i, LocId_i, TxnTypeId_i, CustId_i, DocRef_v, CustRef_v,
          TxnDate_dd, ExpDate_dd, CbaId_i, CctId_i, CsaId_i, DocCba_v, DocCsa_v,
          CbaContact_v, PtermId_i, CurrId_i, CurrRate_d, StermId_i, SpolicyId_i, TaxReg_c,
          SubTotal_d, TaxTotal_d, Rounding_d, GrandTotal_d, Allocated_d, Outstanding_d,
          HsIds_v, BankId_i, DocRemark_t, OwnerId_i, CreateId_i, UpdateId_i
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderData.siteId,
          orderData.locId,
          43, // TxnTypeId for Sales Order
          orderData.customerId,
          orderData.docRef,
          orderData.custRef || '',
          txnDate,
          expiryDate,
          orderData.billingAddressId || null,
          orderData.contactId || null,
          orderData.shippingAddressId || null,
          orderData.docBillingAddress || '',
          orderData.docShippingAddress || '',
          orderData.billingContact || '',
          orderData.paymentTermId,
          orderData.currencyId,
          orderData.currencyRate || 1,
          orderData.shippingTermId,
          orderData.shippingPolicyId,
          orderData.taxReg || 1,
          orderData.subTotal,
          orderData.taxTotal || 0,
          orderData.rounding || 0,
          orderData.grandTotal,
          0, // Allocated
          orderData.grandTotal, // Outstanding 
          orderData.hsIds || '',
          orderData.bankId || null,
          orderData.remark || '',
          userId,
          userId,
          userId
        ]
      );
      
      const orderId = result.insertId;
      
      // Insert order items - matching PHP implementation
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          await connection.execute(
            `INSERT INTO tbl_sorder_item (
              TxnId_i, RowId_i, ProwId_i, ParentId_i, CurrId_i, DocItm_i, ItemId_i, StkId_i, UomId_i,
              QtyDecimal_i, PriceDecimal_i, Qty_d, Price_d, Discount_d, DiscountFlag_c, 
              DiscountAmount_d, ActualPrice_d, LineTotal_d, CreateId_i, UpdateId_i
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              item.rowId,
              item.pRowId || 0,
              item.parentId || null,
              orderData.currencyId,
              item.docItm || null,
              item.itemId,
              item.stockId,
              item.uomId,
              item.qtyDecimal || 2,
              item.priceDecimal || 2,
              item.quantity,
              item.unitPrice,
              item.discount || 0,
              item.discountType || 'P', // P for percentage, V for value
              item.discountAmount || 0,
              item.actualPrice || item.unitPrice,
              item.lineAmount,
              userId,
              userId
            ]
          );
        }
      }
      
      await connection.commit();
      
      return {
        id: orderId,
        docRef: orderData.docRef,
        message: 'Sales order created successfully'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing sales order
   * @param {number} orderId - Sales order ID to update
   * @param {Object} orderData - Updated sales order data
   * @param {number} userId - User ID updating the order
   * @returns {Promise<Object>} Result of the update operation
   */
  static async updateSalesOrder(orderId, orderData, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Convert date format from DD-MM-YYYY to YYYY-MM-DD for database
      const txnDate = moment(orderData.txnDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
      const expiryDate = moment(orderData.expiryDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
      
      // Check update key for concurrency control
      const [keyCheck] = await connection.execute(
        'SELECT UpdateKey_i FROM tbl_sorder_txn WHERE TxnId_i = ? AND TxnTypeId_i = 43',
        [orderId]
      );
      
      if (keyCheck.length === 0) {
        throw new Error('Order not found');
      }
      
      if (keyCheck[0].UpdateKey_i !== orderData.updateKey) {
        throw new Error('Order has been modified by another user');
      }
      
      // Copy to history table
      await connection.execute(
        'INSERT INTO his_sorder_txn SELECT * FROM tbl_sorder_txn WHERE TxnId_i = ?',
        [orderId]
      );
      
      // Update order header - matching PHP implementation
      await connection.execute(
        `UPDATE tbl_sorder_txn SET
          SiteId_i = ?, LocId_i = ?, CustId_i = ?, DocRef_v = ?, CustRef_v = ?,
          TxnDate_dd = ?, ExpDate_dd = ?, CbaId_i = ?, CctId_i = ?, CsaId_i = ?,
          DocCba_v = ?, DocCsa_v = ?, CbaContact_v = ?, PtermId_i = ?, CurrId_i = ?,
          CurrRate_d = ?, StermId_i = ?, SpolicyId_i = ?, TaxReg_c = ?, SubTotal_d = ?,
          TaxTotal_d = ?, Rounding_d = ?, GrandTotal_d = ?, Allocated_d = ?, Outstanding_d = ?,
          HsIds_v = ?, BankId_i = ?, DocRemark_t = ?, OwnerId_i = ?, UpdateId_i = ?, UpdateKey_i = UpdateKey_i + 1
        WHERE TxnId_i = ? AND TxnTypeId_i = 43`,
        [
          orderData.siteId,
          orderData.locId,
          orderData.customerId,
          orderData.docRef,
          orderData.custRef || '',
          txnDate,
          expiryDate,
          orderData.billingAddressId,
          orderData.contactId || null,
          orderData.shippingAddressId,
          orderData.docBillingAddress || '',
          orderData.docShippingAddress || '',
          orderData.billingContact || '',
          orderData.paymentTermId,
          orderData.currencyId,
          orderData.currencyRate,
          orderData.shippingTermId,
          orderData.shippingPolicyId,
          orderData.taxReg || 1,
          orderData.subTotal,
          orderData.taxTotal || 0,
          orderData.rounding || 0,
          orderData.grandTotal,
          orderData.allocated || 0,
          orderData.grandTotal - (orderData.allocated || 0), // Outstanding
          orderData.hsIds || '',
          orderData.bankId || null,
          orderData.remark || '',
          orderData.ownerId || userId,
          userId,
          orderId
        ]
      );
      
      // Copy items to history table
      await connection.execute(
        'INSERT INTO his_sorder_item SELECT * FROM tbl_sorder_item WHERE TxnId_i = ?',
        [orderId]
      );
      
      // Delete old items
      await connection.execute(
        'DELETE FROM tbl_sorder_item WHERE TxnId_i = ?',
        [orderId]
      );
      
      // Insert updated items - matching PHP implementation
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          await connection.execute(
            `INSERT INTO tbl_sorder_item (
              TxnId_i, RowId_i, ProwId_i, ParentId_i, CurrId_i, DocItm_i, ItemId_i, StkId_i, UomId_i,
              QtyDecimal_i, PriceDecimal_i, Qty_d, QtyDone_d, Price_d, Discount_d, DiscountFlag_c, 
              DiscountAmount_d, ActualPrice_d, LineTotal_d, CreateId_i, UpdateId_i
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              item.rowId,
              item.pRowId || 0,
              item.parentId || null,
              orderData.currencyId,
              item.docItm || null,
              item.itemId,
              item.stockId,
              item.uomId,
              item.qtyDecimal || 2,
              item.priceDecimal || 2,
              item.quantity,
              item.quantityDelivered || 0,
              item.unitPrice,
              item.discount || 0,
              item.discountType || 'P',
              item.discountAmount || 0,
              item.actualPrice || item.unitPrice,
              item.lineAmount,
              userId,
              userId
            ]
          );
        }
      }
      
      await connection.commit();
      
      return {
        id: orderId,
        message: 'Sales order updated successfully'
      };
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
   * Get customer addresses
   * @param {number} customerId - Customer ID
   * @returns {Promise<Object>} Billing and shipping addresses
   */
  static async getCustomerAddresses(customerId) {
    const connection = await pool.getConnection();
    try {
      // Get billing addresses
      const [billingRows] = await connection.execute(
        `SELECT 
          CbaId_i as id,
          CbaAddr_v as address,
          CbaContact_v as contact
        FROM tbl_customer_billing_address
        WHERE CustId_i = ?
        ORDER BY CbaId_i`,
        [customerId]
      );
      
      // Get shipping addresses
      const [shippingRows] = await connection.execute(
        `SELECT 
          CsaId_i as id,
          CsaAddr_v as address,
          CsaContact_v as contact
        FROM tbl_customer_shipping_address
        WHERE CustId_i = ?
        ORDER BY CsaId_i`,
        [customerId]
      );
      
      return {
        billingAddresses: billingRows,
        shippingAddresses: shippingRows
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get products for order
   * @returns {Promise<Array>} List of products
   */
  static async getProducts() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          p.ItemId_i as itemId,
          p.StkId_i as stockId,
          p.ProdCode_v as code,
          p.ProdDescr_v as description,
          p.UomId_i as uomId,
          u.UomCode_v as uom,
          p.TaxId_i as taxId,
          t.TaxRate_d as taxRate,
          p.UnitPrice_d as unitPrice
        FROM tbl_product p
        LEFT JOIN tbl_uom u ON u.UomId_i = p.UomId_i
        LEFT JOIN tbl_tax t ON t.TaxId_i = p.TaxId_i
        WHERE p.Status_i = 1
        ORDER BY p.ProdCode_v`
      );
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get payment terms for dropdown
   * @returns {Promise<Array>} List of payment terms
   */
  static async getPaymentTerms() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          PtermId_i as id,
          PtermName_v as code,
          PtermMemo_v as description
        FROM tbl_payterm
        ORDER BY PtermName_v`
      );
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get shipping terms for dropdown
   * @returns {Promise<Array>} List of shipping terms
   */
  static async getShippingTerms() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          StermId_i as id,
          StermCode_c as code,
          StermDescr_v as description
        FROM tbl_sterm
        ORDER BY StermCode_c`
      );
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get shipping policies for dropdown
   * @returns {Promise<Array>} List of shipping policies
   */
  static async getShippingPolicies() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          SpolicyId_i as id,
          SpolicyCode_c as code,
          SpolicyDescr_v as description
        FROM tbl_spolicy
        ORDER BY SpolicyCode_c`
      );
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get currencies for dropdown
   * @returns {Promise<Array>} List of currencies
   */
  static async getCurrencies() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          CurrId_i as id,
          CurrCode_c as code,
          CurrDescr_v as description,
          CurrSymbol_c as symbol,
          COALESCE(CurrRate_d, 1) as rate
        FROM tbl_currency
        ORDER BY CurrCode_c`
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
      const prefix = 'SO';
      const date = moment().format('YYYYMMDD');
      
      // Get the last document number for today
      const [rows] = await connection.execute(
        `SELECT DocRef_v FROM tbl_sorder_txn 
         WHERE DocRef_v LIKE ? AND TxnTypeId_i = 43
         ORDER BY TxnId_i DESC LIMIT 1`,
        [`${prefix}/${date}/%`]
      );
      
      let seq = 1;
      if (rows.length > 0) {
        // Extract sequence number from last document
        const lastRef = rows[0].DocRef_v;
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
}

module.exports = OrderModel;
