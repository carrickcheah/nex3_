const db = require('../../../../config/database');

/**
 * Get list of billing addresses with pagination, search, and sorting
 */
exports.getBillingAddresses = async (page, limit, search, sortField, sortOrder) => {
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
      'location_name': 'cb.CbaLocname_v',
      'country_name': 'tc.CountryName_v',
      'state': 'st.StateName_v',
      'area_city': 'cb.CbaCity_v',
      'postcode': 'cb.CbaPostcode_v',
      'default': 'cb.Def_i',
      'status': 'cb.Status_i'
    };
    
    // Use mapped sort field or default to customer ID
    const dbSortField = sortFieldMap[sortField] || 'c.CustId_i';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tbl_customer c
      LEFT JOIN tbl_cust_billaddr cb ON c.CustId_i = cb.CustId_i
      LEFT JOIN tbl_country tc ON cb.CountryId_i = tc.CountryId_i
      LEFT JOIN tbl_state st ON cb.CbastateId_i = st.StateId_i
      WHERE cb.Status_i != 9
      ${search ? 'AND (c.CustName_v LIKE ? OR c.IntId_v LIKE ? OR cb.CbaLocname_v LIKE ? OR tc.CountryName_v LIKE ?)' : ''}
    `;
    
    const countParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];
    const [countResult] = await db.query(countQuery, countParams);
    
    // Get paginated data with sorting
    const query = `
      SELECT 
          cb.CbaId_i as billing_id,
          c.CustId_i as customer_id,
          c.CustId_i as customer_seq_no,
          c.CustName_v as customer_name,
          c.IntId_v as internal_id,
          cb.CbaLocname_v as location_name,
          tc.CountryName_v as country_name,
          st.StateName_v as state,
          cb.CbaCity_v as area_city,
          cb.CbaPostcode_v as postcode,
          cb.Def_i as is_default,
          cb.Status_i as status
      FROM tbl_customer c
      LEFT JOIN tbl_cust_billaddr cb ON c.CustId_i = cb.CustId_i
      LEFT JOIN tbl_country tc ON cb.CountryId_i = tc.CountryId_i
      LEFT JOIN tbl_state st ON cb.CbastateId_i = st.StateId_i
      WHERE cb.Status_i != 9
      ${search ? 'AND (c.CustName_v LIKE ? OR c.IntId_v LIKE ? OR cb.CbaLocname_v LIKE ? OR tc.CountryName_v LIKE ?)' : ''}
      ORDER BY ${dbSortField} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `;
    
    const params = search 
      ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), offset] 
      : [parseInt(limit), offset];
    
    const [addresses] = await db.query(query, params);
    
    return {
      addresses,
      total: countResult[0].total
    };
  } catch (error) {
    console.error('Error in getBillingAddresses model:', error);
    throw error;
  }
};

/**
 * Get billing address by ID
 */
exports.getBillingAddressById = async (billingId) => {
  try {
    const query = `
      SELECT 
          cb.CbaId_i as billing_id,
          c.CustId_i as customer_id,
          c.CustName_v as customer_name,
          c.IntId_v as internal_id,
          cb.CbaLocname_v as location_name,
          cb.CbaAddr1_v as address_line1,
          cb.CbaAddr2_v as address_line2,
          cb.CbaCity_v as area_city,
          st.StateName_v as state,
          cb.CbaPostcode_v as postcode,
          cb.CountryId_i as country_id,
          tc.CountryName_v as country_name,
          cb.CbaPhone_v as phone,
          cb.CbaEmail_v as email,
          cb.CbaContact_v as contact_person,
          cb.Def_i as is_default,
          cb.Status_i as status,
          cb.Created_by as created_by,
          cb.Created_dt as created_at,
          cb.Modified_dt as updated_at
      FROM tbl_cust_billaddr cb
      LEFT JOIN tbl_customer c ON cb.CustId_i = c.CustId_i
      LEFT JOIN tbl_country tc ON cb.CountryId_i = tc.CountryId_i
      LEFT JOIN tbl_state st ON cb.CbastateId_i = st.StateId_i
      WHERE cb.CbaId_i = ? AND cb.Status_i != 9
    `;
    
    const [results] = await db.query(query, [billingId]);
    
    if (results.length === 0) {
      return null;
    }
    
    return results[0];
  } catch (error) {
    console.error('Error in getBillingAddressById model:', error);
    throw error;
  }
};

/**
 * Create a new billing address
 */
exports.createBillingAddress = async (addressData) => {
  try {
    // Start a transaction
    await db.query('START TRANSACTION');
    
    // If this is set as default, unset any existing default for this customer
    if (addressData.is_default === 1) {
      const unsetQuery = `
        UPDATE tbl_cust_billaddr
        SET Def_i = 0
        WHERE CustId_i = ? AND Def_i = 1
      `;
      
      await db.query(unsetQuery, [addressData.customer_id]);
    }
    
    // Insert new billing address
    const query = `
      INSERT INTO tbl_cust_billaddr (
        CustId_i, IntId_v, CbaLocname_v, CbaAddr1_v, CbaAddr2_v,
        CbaCity_v, CbastateId_i, CbaPostcode_v, CountryId_i, CbaPhone_v, CbaEmail_v, CbaContact_v,
        Def_i, Status_i, Created_by, Created_dt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const params = [
      addressData.customer_id,
      addressData.internal_id,
      addressData.location_name,
      addressData.address_line1,
      addressData.address_line2,
      addressData.area_city,
      addressData.state,
      addressData.postcode,
      addressData.country_id,
      addressData.phone,
      addressData.email,
      addressData.contact_person,
      addressData.is_default || 0,
      addressData.status || 1,
      addressData.user_id || 1
    ];
    
    const [result] = await db.query(query, params);
    
    // Commit the transaction
    await db.query('COMMIT');
    
    return {
      success: true,
      billingId: result.insertId
    };
  } catch (error) {
    // Rollback in case of error
    await db.query('ROLLBACK');
    console.error('Error in createBillingAddress model:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        message: 'A billing address with this location name already exists for this customer'
      };
    }
    
    throw error;
  }
};

/**
 * Update a billing address
 */
exports.updateBillingAddress = async (billingId, addressData) => {
  try {
    // Start a transaction
    await db.query('START TRANSACTION');
    
    // If this is set as default, unset any existing default for this customer
    if (addressData.is_default === 1) {
      const unsetQuery = `
        UPDATE tbl_cust_billaddr
        SET Def_i = 0
        WHERE CustId_i = ? AND Def_i = 1 AND CbaId_i != ?
      `;
      
      await db.query(unsetQuery, [addressData.customer_id, billingId]);
    }
    
    // Update the billing address
    const query = `
      UPDATE tbl_cust_billaddr
      SET CustId_i = ?,
          IntId_v = ?,
          CbaLocname_v = ?,
          CbaAddr1_v = ?,
          CbaAddr2_v = ?,
          CbaCity_v = ?,
          CbastateId_i = ?,
          CbaPostcode_v = ?,
          CountryId_i = ?,
          CbaPhone_v = ?,
          CbaEmail_v = ?,
          CbaContact_v = ?,
          Def_i = ?,
          Status_i = ?,
          Modified_by = ?,
          Modified_dt = NOW()
      WHERE CbaId_i = ?
    `;
    
    const params = [
      addressData.customer_id,
      addressData.internal_id,
      addressData.location_name,
      addressData.address_line1,
      addressData.address_line2,
      addressData.area_city,
      addressData.state,
      addressData.postcode,
      addressData.country_id,
      addressData.phone,
      addressData.email,
      addressData.contact_person,
      addressData.is_default || 0,
      addressData.status,
      addressData.user_id || 1,
      billingId
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
    console.error('Error in updateBillingAddress model:', error);
    throw error;
  }
};

/**
 * Delete a billing address (soft delete)
 */
exports.deleteBillingAddress = async (billingId) => {
  try {
    // Soft delete by setting status to 9
    const query = `
      UPDATE tbl_cust_billaddr SET
        Status_i = 9,
        Modified_dt = NOW()
      WHERE CbaId_i = ?
    `;
    
    const [result] = await db.query(query, [billingId]);
    
    return result;
  } catch (error) {
    console.error('Error in deleteBillingAddress model:', error);
    throw error;
  }
};

/**
 * Get countries for dropdown
 */
exports.getCountries = async () => {
  try {
    const query = `
      SELECT CountryId_i as country_id, CountryName_v as country_name
      FROM tbl_country
      WHERE Status_i = 1
      ORDER BY CountryName_v ASC
    `;
    
    const [countries] = await db.query(query);
    
    return countries;
  } catch (error) {
    console.error('Error in getCountries model:', error);
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