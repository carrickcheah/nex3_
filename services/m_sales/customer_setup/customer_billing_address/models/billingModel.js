const db = require('../../../../config/database');

/**
 * Get list of billing addresses with pagination, search, and sorting
 */
exports.getBillingAddresses = async (page, limit, search, sortField, sortOrder) => {
  try {
    const offset = (page - 1) * limit;
    
    // Default sort field and order if not provided
    sortField = sortField || 'customer';
    sortOrder = sortOrder || 'asc';
    
    // Map front-end sort fields to database columns
    const sortFieldMap = {
      'seq_no': 'cb.CbaId_i',
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
    
    // Use mapped sort field or default to customer name
    const dbSortField = sortFieldMap[sortField] || 'c.CustName_v';
    
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
    
    // Get paginated data with sorting using the exact query format provided
    const query = `
      SELECT 
          cb.CbaId_i as billing_id,
          c.CustId_i as customer_id,
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
          b.billing_id,
          b.customer_id,
          c.customer_name,
          b.internal_id,
          b.location_name,
          b.address_line1,
          b.address_line2,
          b.area_city,
          b.state,
          b.postcode,
          b.country_id,
          country.country_name,
          b.phone,
          b.email,
          b.contact_person,
          b.is_default,
          b.status
      FROM tbl_customer_billing_address b
      LEFT JOIN tbl_customer c ON b.customer_id = c.customer_id
      LEFT JOIN tbl_country country ON b.country_id = country.country_id
      WHERE b.billing_id = ? AND b.status != 9
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
        UPDATE tbl_customer_billing_address
        SET is_default = 0
        WHERE customer_id = ? AND is_default = 1
      `;
      
      await db.query(unsetQuery, [addressData.customer_id]);
    }
    
    // Insert new billing address
    const query = `
      INSERT INTO tbl_customer_billing_address (
        customer_id, internal_id, location_name, address_line1, address_line2,
        area_city, state, postcode, country_id, phone, email, contact_person,
        is_default, status, created_by, created_at
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
        UPDATE tbl_customer_billing_address
        SET is_default = 0
        WHERE customer_id = ? AND is_default = 1 AND billing_id != ?
      `;
      
      await db.query(unsetQuery, [addressData.customer_id, billingId]);
    }
    
    // Update the billing address
    const query = `
      UPDATE tbl_customer_billing_address
      SET customer_id = ?,
          internal_id = ?,
          location_name = ?,
          address_line1 = ?,
          address_line2 = ?,
          area_city = ?,
          state = ?,
          postcode = ?,
          country_id = ?,
          phone = ?,
          email = ?,
          contact_person = ?,
          is_default = ?,
          status = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE billing_id = ?
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
      UPDATE tbl_customer_billing_address SET
        status = 9,
        updated_at = NOW()
      WHERE billing_id = ?
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
      SELECT country_id, country_name
      FROM tbl_country
      WHERE status = 1
      ORDER BY country_name ASC
    `;
    
    const [countries] = await db.query(query);
    
    return countries;
  } catch (error) {
    console.error('Error in getCountries model:', error);
    throw error;
  }
};