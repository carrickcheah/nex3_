const db = require('../../../../config/database');

// Get price list with exact SQL query as provided
exports.getPriceList = async (page, limit, search, sortField, sortOrder) => {
  try {
    // Ensure pagination is always applied
    const offset = (page - 1) * limit;
    // Default to 50 rows if not specified
    const safeLimit = limit ? parseInt(limit) : 50;
    
    // Base SQL query from user requirements - DO NOT MODIFY THIS
    let query = `
    SELECT
      c.CustId_i as "customer id",
      c.CustName_v as "customer",
      pc.StkCode_v as "stock code",
      di.StkCode_v as "stock / alias code",
      pc.ProdName_v as "product name",
      cs.Moq_d as "moq",
      cr.CurrCode_c as "currency",
      cs.Price_d as "unit price",
      cs.StartDate_dd as "effective date",
      cs.Status_i as "status",
      cs.CustmoqId_i as "id"
    FROM tbl_customer c
    LEFT JOIN tbl_custmoq_setup cs ON c.CustId_i = cs.CustId_i
    LEFT JOIN tbl_product_code pc ON cs.StkId_i = pc.StkId_i
    LEFT JOIN tbl_doc_itm di ON pc.StkId_i = di.StkId_i
    LEFT JOIN tbl_currency cr ON cs.CurrId_i = cr.CurrId_i
    WHERE c.Status_i = 1
      AND cs.Status_c = 'A'`;
    
    // Search condition - only add WHERE if search provided
    const searchParams = [];
    if (search && search.trim() !== '') {
      query += ` AND (c.CustName_v LIKE ? OR pc.StkCode_v LIKE ? OR pc.ProdName_v LIKE ?)`;
      searchParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const [countResult] = await db.query(countQuery, searchParams);
    
    // Map frontend sort fields to query columns
    let orderByField;
    if (sortField === 'seq_no') orderByField = 'c.CustId_i';
    else if (sortField === 'customer') orderByField = 'c.CustName_v';
    else if (sortField === 'stock_code') orderByField = 'pc.StkCode_v';
    else if (sortField === 'alias_code') orderByField = 'di.StkCode_v';
    else if (sortField === 'product_name') orderByField = 'pc.ProdName_v';
    else if (sortField === 'moq') orderByField = 'cs.Moq_d';
    else if (sortField === 'currency') orderByField = 'cr.CurrCode_c';
    else if (sortField === 'unit_price') orderByField = 'cs.Price_d';
    else if (sortField === 'effective_date') orderByField = 'cs.StartDate_dd';
    else if (sortField === 'status') orderByField = 'cs.Status_i';
    else orderByField = 'c.CustId_i'; // Default sort
    
    // Add sorting
    query += ` ORDER BY ${orderByField} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    
    // Add pagination
    query += ` LIMIT ? OFFSET ?`;
    
    // Combine all parameters
    const queryParams = [...searchParams, safeLimit, offset];
    
    // Execute the query
    const [rows] = await db.query(query, queryParams);
    
    // Map SQL column names to JavaScript object properties
    const priceListItems = rows.map(row => {
      return {
        customer_id: row['customer id'],
        customer_name: row['customer'],
        stock_code: row['stock code'],
        alias_code: row['stock / alias code'],
        product_name: row['product name'],
        moq: row['moq'],
        currency: row['currency'],
        unit_price: row['unit price'],
        effective_date: row['effective date'],
        status: row['status'],
        id: row['id']
      };
    });
    
    return {
      priceListItems,
      total: countResult[0].total
    };
  } catch (error) {
    console.error('Error in priceModel.getPriceList:', error);
    throw error;
  }
};

// Get a single price list item by ID
exports.getPriceListItemById = async (id) => {
  try {
    const query = `
    SELECT
      c.CustId_i as "customer_id",
      c.CustName_v as "customer_name",
      pc.StkCode_v as "stock_code",
      di.StkCode_v as "alias_code",
      pc.ProdName_v as "product_name",
      cs.Moq_d as "moq",
      cr.CurrCode_c as "currency",
      cs.Price_d as "unit_price",
      cs.StartDate_dd as "effective_date",
      cs.Status_i as "status",
      cs.id as "id"
    FROM tbl_customer c
    LEFT JOIN tbl_custmoq_setup cs ON c.CustId_i = cs.CustId_i
    LEFT JOIN tbl_product_code pc ON cs.StkId_i = pc.StkId_i
    LEFT JOIN tbl_doc_itm di ON pc.StkId_i = di.StkId_i
    LEFT JOIN tbl_currency cr ON cs.CurrId_i = cr.CurrId_i
    WHERE c.Status_i = 1
      AND cs.Status_c = 'A'`;


    const [rows] = await db.query(query, [id]);
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error in priceModel.getPriceListItemById:', error);
    throw error;
  }
};

// Create a new price list item
exports.createPriceListItem = async (data) => {
  try {
    // Get stock ID from stock code
    const [stockResult] = await db.query('SELECT StkId_i FROM tbl_product_code WHERE StkCode_v = ?', [data.stock_code]);
    if (stockResult.length === 0) {
      throw new Error('Invalid stock code');
    }
    const stockId = stockResult[0].StkId_i;
    
    // Get currency ID (default to 1 if not provided)
    let currencyId = 1;
    if (data.currency) {
      const [currencyResult] = await db.query('SELECT CurrId_i FROM tbl_currency WHERE CurrCode_c = ?', [data.currency]);
      if (currencyResult.length > 0) {
        currencyId = currencyResult[0].CurrId_i;
      }
    }
    
    const query = `
    INSERT INTO tbl_custmoq_setup 
    (CustId_i, StkId_i, CurrId_i, Moq_d, Price_d, StartDate_dd, Status_i, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    
    const [result] = await db.query(query, [
      data.customer_id,
      stockId,
      currencyId,
      data.moq || 1,
      data.unit_price,
      data.effective_date,
      data.status,
      data.created_by || 1
    ]);
    
    return result.insertId;
  } catch (error) {
    console.error('Error in priceModel.createPriceListItem:', error);
    throw error;
  }
};

// Update a price list item
exports.updatePriceListItem = async (id, data) => {
  try {
    // Get stock ID from stock code
    const [stockResult] = await db.query('SELECT StkId_i FROM tbl_product_code WHERE StkCode_v = ?', [data.stock_code]);
    if (stockResult.length === 0) {
      throw new Error('Invalid stock code');
    }
    const stockId = stockResult[0].StkId_i;
    
    // Get currency ID
    let currencyId = 1;
    if (data.currency) {
      const [currencyResult] = await db.query('SELECT CurrId_i FROM tbl_currency WHERE CurrCode_c = ?', [data.currency]);
      if (currencyResult.length > 0) {
        currencyId = currencyResult[0].CurrId_i;
      }
    }
    
    const query = `
    UPDATE tbl_custmoq_setup
    SET CustId_i = ?, StkId_i = ?, CurrId_i = ?, Moq_d = ?, Price_d = ?, 
        StartDate_dd = ?, Status_i = ?, updated_by = ?, updated_at = NOW()
    WHERE id = ?`;
    
    const [result] = await db.query(query, [
      data.customer_id,
      stockId,
      currencyId,
      data.moq || 1,
      data.unit_price,
      data.effective_date,
      data.status,
      data.updated_by || 1,
      id
    ]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in priceModel.updatePriceListItem:', error);
    throw error;
  }
};

// Delete a price list item
exports.deletePriceListItem = async (id) => {
  try {
    const query = 'DELETE FROM tbl_custmoq_setup WHERE id = ?';
    const [result] = await db.query(query, [id]);
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in priceModel.deletePriceListItem:', error);
    throw error;
  }
};

module.exports = exports;
