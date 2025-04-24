const db = require('../../../../config/database');

/**
 * Get list of customers with pagination and search
 */
exports.getCustomers = async (page, limit, search) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tbl_customer c
      WHERE 1=1
      ${search ? 'AND (c.CustName_v LIKE ? OR c.CustAbbrev_v LIKE ?)' : ''}
    `;
    
    const countParams = search ? [`%${search}%`, `%${search}%`] : [];
    const [countResult] = await db.query(countQuery, countParams);
    
    // Get paginated data
    const query = `
      SELECT 
          c.CustId_i as customer_id,
          c.CustName_v as 'customer_name',
          c.CustAbbrev_v as 'short_name',
          c.CustTag_v as 'tag',
          c.AcctId_v as 'account_id',
          tc.TaxCode_v as 'tax_code',
          c.ExemptNo_v as 'exemption_certificate',
          p.PtermName_v as 'payment_term',
          c.Status_i as 'status'
      FROM tbl_customer c
      LEFT JOIN tbl_taxcode tc ON tc.TaxcodeId_i = c.TaxcodeId_i
      LEFT JOIN tbl_payterm p ON p.PtermId_i = c.PtermId_i
      WHERE 1=1
      ${search ? 'AND (c.CustName_v LIKE ? OR c.CustAbbrev_v LIKE ?)' : ''}
      ORDER BY c.CustName_v
      LIMIT ? OFFSET ?
    `;
    
    const params = search 
      ? [`%${search}%`, `%${search}%`, parseInt(limit), offset] 
      : [parseInt(limit), offset];
    
    const [customers] = await db.query(query, params);
    
    return {
      customers,
      total: countResult[0].total
    };
  } catch (error) {
    console.error('Error in getCustomers model:', error);
    throw error;
  }
};

/**
 * Get customer by ID
 */
exports.getCustomerById = async (customerId) => {
  try {
    const query = `
      SELECT c.customer_id, c.customer_code, c.customer_name, c.short_name, c.tag,
             c.account_id, c.tax_code, c.exemption_certificate, c.payment_term,
             c.customer_type_id, c.email, c.phone, c.address, c.status,
             ct.customer_type_name
      FROM tbl_m_customer c
      LEFT JOIN tbl_m_customer_type ct ON c.customer_type_id = ct.customer_type_id
      WHERE c.customer_id = ? AND c.status != 9
    `;
    
    const [results] = await db.query(query, [customerId]);
    
    if (results.length === 0) {
      return null;
    }
    
    return results[0];
  } catch (error) {
    console.error('Error in getCustomerById model:', error);
    throw error;
  }
};

/**
 * Get customer by code
 */
exports.getCustomerByCode = async (customerCode) => {
  try {
    const query = `
      SELECT * FROM tbl_m_customer
      WHERE customer_code = ? AND status != 9
    `;
    
    const [customers] = await db.query(query, [customerCode]);
    
    if (customers.length === 0) {
      return null;
    }
    
    return customers[0];
  } catch (error) {
    console.error('Error in getCustomerByCode model:', error);
    throw error;
  }
};

/**
 * Create a new customer
 */
exports.createCustomer = async (customerData) => {
  try {
    const query = `
      INSERT INTO tbl_m_customer (
        customer_code, customer_name, short_name, tag, account_id, 
        tax_code, exemption_certificate, payment_term,
        customer_type_id, email, phone, address, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      customerData.customer_code,
      customerData.customer_name,
      customerData.short_name,
      customerData.tag,
      customerData.account_id,
      customerData.tax_code,
      customerData.exemption_certificate,
      customerData.payment_term,
      customerData.customer_type_id,
      customerData.email,
      customerData.phone,
      customerData.address,
      customerData.status || 1,
      customerData.user_id || 1
    ];
    
    const [result] = await db.query(query, params);
    
    return {
      success: true,
      customerId: result.insertId
    };
  } catch (error) {
    console.error('Error in createCustomer model:', error);
    
    // Check for duplicate entry
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        message: 'A customer with this code already exists'
      };
    }
    
    throw error;
  }
};

/**
 * Update a customer
 */
exports.updateCustomer = async (customerId, customerData) => {
  try {
    const query = `
      UPDATE tbl_m_customer
      SET customer_name = ?,
          short_name = ?,
          tag = ?,
          account_id = ?,
          tax_code = ?,
          exemption_certificate = ?,
          payment_term = ?,
          customer_type_id = ?,
          email = ?,
          phone = ?,
          address = ?,
          status = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE customer_id = ?
    `;
    
    const params = [
      customerData.customer_name,
      customerData.short_name,
      customerData.tag,
      customerData.account_id,
      customerData.tax_code,
      customerData.exemption_certificate,
      customerData.payment_term,
      customerData.customer_type_id,
      customerData.email,
      customerData.phone,
      customerData.address,
      customerData.status,
      customerData.user_id || 1,
      customerId
    ];
    
    const [result] = await db.query(query, params);
    
    return {
      success: true,
      affectedRows: result.affectedRows
    };
  } catch (error) {
    console.error('Error in updateCustomer model:', error);
    throw error;
  }
};

/**
 * Delete a customer (soft delete)
 */
exports.deleteCustomer = async (customerId) => {
  try {
    // Soft delete by setting status to 9
    const query = `
      UPDATE tbl_m_customer SET
        status = 9
      WHERE customer_id = ?
    `;
    
    const [result] = await db.query(query, [customerId]);
    
    return result;
  } catch (error) {
    console.error('Error in deleteCustomer model:', error);
    throw error;
  }
};

/**
 * Get customer types (for dropdowns)
 */
exports.getCustomerTypes = async () => {
  try {
    const query = `
      SELECT customer_type_id, customer_type_name
      FROM tbl_m_customer_type
      WHERE status = 1
      ORDER BY customer_type_name ASC
    `;
    
    const [customerTypes] = await db.query(query);
    
    return customerTypes;
  } catch (error) {
    console.error('Error in getCustomerTypes model:', error);
    throw error;
  }
}; 