const db = require('../../../../config/database');

/**
 * Get list of customer currencies with pagination, search, and sorting
 */
exports.getCustomerCurrencies = async (page, limit, search, sortField, sortOrder) => {
  try {
    const offset = (page - 1) * limit;
    
    // Default sort field and order if not provided
    sortField = sortField || 'seq_no';
    sortOrder = sortOrder || 'asc';
    
    // Map front-end sort fields to database columns
    const sortFieldMap = {
      'seq_no': 'c.CustId_i',
      'customer': 'c.CustName_v',
      'internal_id': 'c.IntId_v',
      'account_id': 'c.AcctId_v',
      'currency': 'cr.CurrCode_c',
      'default': 'cc.Def_i',
      'status': 'c.Status_i'
    };
    
    // Use mapped sort field or default to customer ID
    const dbSortField = sortFieldMap[sortField] || 'c.CustId_i';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tbl_customer c
      LEFT JOIN tbl_cct_cust cct ON c.CustId_i = cct.CustId_i
      LEFT JOIN tbl_cust_contact cc ON cct.CctId_i = cc.CctId_i
      LEFT JOIN tbl_currency cr ON cr.Def_i = 1
      WHERE c.Status_i != 9
      ${search ? 'AND (c.CustName_v LIKE ? OR c.IntId_v LIKE ? OR c.AcctId_v LIKE ? OR cr.CurrCode_c LIKE ?)' : ''}
    `;
    
    const countParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];
    const [countResult] = await db.query(countQuery, countParams);
    
    // Get paginated data with sorting
    const query = `
      SELECT
          c.CustId_i as "customer id",
          c.CustName_v as "customer",
          c.IntId_v as "internal id",
          c.AcctId_v as "account_id",
          cr.CurrCode_c as "currency",
          cr.Status_i as "default",
          c.Status_i as "status"
      FROM tbl_customer c
      LEFT JOIN tbl_cct_cust cct ON c.CustId_i = cct.CustId_i
      LEFT JOIN tbl_cust_contact cc ON cct.CctId_i = cc.CctId_i
      LEFT JOIN tbl_currency cr ON cr.Def_i = 1
      WHERE c.Status_i != 9
      ${search ? 'AND (c.CustName_v LIKE ? OR c.IntId_v LIKE ? OR c.AcctId_v LIKE ? OR cr.CurrCode_c LIKE ?)' : ''}
      ORDER BY ${dbSortField} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `;
    
    const params = search 
      ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), offset] 
      : [parseInt(limit), offset];
    
    const [rawCurrencies] = await db.query(query, params);
    
    // Map the raw results to match the expected field names in the frontend
    const currencies = rawCurrencies.map(item => ({
      customer_id: item['customer id'],
      customer_name: item['customer'],
      internal_id: item['internal id'],
      account_id: item['account_id'],
      currency: item['currency'],
      is_default: item['default'],
      status: item['status']
    }));
    
    return {
      currencies,
      total: countResult[0].total
    };
  } catch (error) {
    console.error('Error in getCustomerCurrencies model:', error);
    throw error;
  }
};

/**
 * Get customer currency by ID
 */
exports.getCustomerCurrencyById = async (customerId) => {
  try {
    const query = `
      SELECT 
          c.CustId_i as "customer id",
          c.CustName_v as "customer",
          c.IntId_v as "internal id",
          c.AcctId_v as "account_id",
          cr.CurrId_i as "currency id",
          cr.CurrCode_c as "currency",
          cr.CurrName_v as "currency name",
          cc.Def_i as "default",
          c.Status_i as "status",
          c.Created_by as "created by",
          c.Created_dt as "created at",
          c.Modified_dt as "updated at"
      FROM tbl_customer c
      LEFT JOIN tbl_cct_cust cct ON c.CustId_i = cct.CustId_i
      LEFT JOIN tbl_cust_contact cc ON cct.CctId_i = cc.CctId_i
      LEFT JOIN tbl_currency cr ON cr.Def_i = 1
      WHERE c.CustId_i = ? AND c.Status_i != 9
    `;
    
    const [results] = await db.query(query, [customerId]);
    
    if (results.length === 0) {
      return null;
    }
    
    // Map the result to match expected field names
    const item = results[0];
    return {
      customer_id: item['customer id'],
      customer_name: item['customer'],
      internal_id: item['internal id'],
      account_id: item['account_id'],
      currency_id: item['currency id'],
      currency: item['currency'],
      currency_name: item['currency name'],
      is_default: item['default'],
      status: item['status'],
      created_by: item['created by'],
      created_at: item['created at'],
      updated_at: item['updated at']
    };
  } catch (error) {
    console.error('Error in getCustomerCurrencyById model:', error);
    throw error;
  }
};

/**
 * Create a new customer currency
 */
exports.createCustomerCurrency = async (currencyData) => {
  try {
    // Start a transaction
    await db.query('START TRANSACTION');
    
    // If this is set as default, unset any existing default for this customer
    if (currencyData.is_default === 1) {
      const unsetQuery = `
        UPDATE tbl_cust_contact
        SET Def_i = 0
        WHERE CctId_i IN (SELECT CctId_i FROM tbl_cct_cust WHERE CustId_i = ?)
      `;
      
      await db.query(unsetQuery, [currencyData.customer_id]);
    }
    
    // Insert new customer currency relation
    const query = `
      INSERT INTO tbl_cct_cust (
        CustId_i, CurrId_i, Def_i, Status_i, Created_by, Created_dt
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `;
    
    const params = [
      currencyData.customer_id,
      currencyData.currency_id,
      currencyData.is_default || 0,
      currencyData.status || 1,
      currencyData.user_id || 1
    ];
    
    const [result] = await db.query(query, params);
    
    // Commit the transaction
    await db.query('COMMIT');
    
    return {
      success: true,
      currencyId: result.insertId
    };
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error('Error in createCustomerCurrency model:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        message: 'This currency is already assigned to this customer'
      };
    }
    
    throw error;
  }
};

/**
 * Update a customer currency
 */
exports.updateCustomerCurrency = async (relationId, currencyData) => {
  try {
    // Start a transaction
    await db.query('START TRANSACTION');
    
    // If this is set as default, unset any existing default for this customer
    if (currencyData.is_default === 1) {
      const unsetQuery = `
        UPDATE tbl_cust_contact
        SET Def_i = 0
        WHERE CctId_i IN (SELECT CctId_i FROM tbl_cct_cust WHERE CustId_i = ? AND CctCustId_i != ?)
      `;
      
      await db.query(unsetQuery, [currencyData.customer_id, relationId]);
    }
    
    // Update the customer currency
    const query = `
      UPDATE tbl_cct_cust
      SET CustId_i = ?,
          CurrId_i = ?,
          Def_i = ?,
          Status_i = ?,
          Modified_by = ?,
          Modified_dt = NOW()
      WHERE CctCustId_i = ?
    `;
    
    const params = [
      currencyData.customer_id,
      currencyData.currency_id,
      currencyData.is_default || 0,
      currencyData.status,
      currencyData.user_id || 1,
      relationId
    ];
    
    const [result] = await db.query(query, params);
    
    // Commit the transaction
    await db.query('COMMIT');
    
    return {
      success: true,
      affectedRows: result.affectedRows
    };
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error('Error in updateCustomerCurrency model:', error);
    throw error;
  }
};

/**
 * Delete a customer currency (soft delete)
 */
exports.deleteCustomerCurrency = async (relationId) => {
  try {
    // Soft delete by setting status to 9
    const query = `
      UPDATE tbl_cct_cust SET
        Status_i = 9,
        Modified_dt = NOW()
      WHERE CctCustId_i = ?
    `;
    
    const [result] = await db.query(query, [relationId]);
    
    return result;
  } catch (error) {
    console.error('Error in deleteCustomerCurrency model:', error);
    throw error;
  }
};

/**
 * Get currencies for dropdown
 */
exports.getCurrencies = async () => {
  try {
    const query = `
      SELECT CurrId_i as currency_id, CONCAT(CurrCode_c, ' - ', CurrName_v) as currency_name
      FROM tbl_currency
      WHERE Status_i = 1
      ORDER BY CurrCode_c ASC
    `;
    
    const [currencies] = await db.query(query);
    
    return currencies;
  } catch (error) {
    console.error('Error in getCurrencies model:', error);
    throw error;
  }
};

/**
 * Get customers for dropdown
 */
exports.getCustomers = async () => {
  try {
    const query = `
      SELECT CustId_i as customer_id, CustName_v as customer_name
      FROM tbl_customer
      WHERE Status_i = 1
      ORDER BY CustName_v ASC
    `;
    
    const [customers] = await db.query(query);
    
    return customers;
  } catch (error) {
    console.error('Error in getCustomers model:', error);
    throw error;
  }
};
