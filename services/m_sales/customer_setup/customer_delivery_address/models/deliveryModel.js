const db = require('../../../../config/database');

/**
 * Get all delivery addresses with pagination, search, and sorting
 */
exports.getDeliveryAddresses = async ({ page = 1, limit = 50, search = '' }) => {
  try {
    const offset = (page - 1) * limit;
    
    // Count total records
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
      FROM tbl_customer c
      LEFT JOIN tbl_cust_billaddr cb ON c.CustId_i = cb.CustId_i
      LEFT JOIN tbl_country co ON cb.CountryId_i = co.CountryId_i
      LEFT JOIN tbl_state s ON cb.CountryId_i = s.CountryId_i
      WHERE cb.Status_i != 9`
    );
    
    // Get paginated and filtered data
    const dataQuery = `
      SELECT
        c.CustId_i as 'customer id',
        c.CustName_v as 'customer',
        c.CustAbbrev_v as 'delivery to',
        co.CountryName_v as 'country',
        cb.CbastateId_i as 'state',
        cb.CbaCity_v as 'area',
        cb.CbaPostcode_v as 'postcode',
        cb.Def_i as 'default',
        cb.Status_i as 'status'
      FROM tbl_customer c
      LEFT JOIN tbl_cust_billaddr cb ON c.CustId_i = cb.CustId_i
      LEFT JOIN tbl_country co ON cb.CountryId_i = co.CountryId_i
      LEFT JOIN tbl_state s ON cb.CountryId_i = s.CountryId_i
      WHERE cb.Status_i != 9
      ${search ? 'AND (c.CustName_v LIKE ? OR c.CustAbbrev_v LIKE ? OR co.CountryName_v LIKE ? OR cb.CbaCity_v LIKE ?)' : ''}
      ORDER BY c.CustId_i ASC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = search ? 
      [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), offset] :
      [parseInt(limit), offset];
    
    const [deliveryAddresses] = await db.query(dataQuery, dataParams);
    
    return {
      data: deliveryAddresses,
      pagination: {
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit),
        page: page
      }
    };
  } catch (error) {
    console.error('Error in getDeliveryAddresses model:', error);
    throw error;
  }
};

/**
 * Get delivery address by ID
 */
exports.getDeliveryAddressById = async (deliveryAddressId) => {
  try {
    const [rows] = await db.query(
      `SELECT
        c.CustId_i as 'customer id',
        c.CustName_v as 'customer',
        c.CustAbbrev_v as 'delivery to',
        co.CountryName_v as 'country',
        cb.CbastateId_i as 'state',
        cb.CbaCity_v as 'area',
        cb.CbaPostcode_v as 'postcode',
        cb.Def_i as 'default',
        cb.Status_i as 'status'
      FROM tbl_customer c
      LEFT JOIN tbl_cust_billaddr cb ON c.CustId_i = cb.CustId_i
      LEFT JOIN tbl_country co ON cb.CountryId_i = co.CountryId_i
      LEFT JOIN tbl_state s ON cb.CountryId_i = s.CountryId_i
      WHERE c.CustId_i = ? AND cb.Status_i != 9`,
      [deliveryAddressId]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error in getDeliveryAddressById model:', error);
    throw error;
  }
};

/**
 * Get delivery addresses for a specific customer
 */
exports.getDeliveryAddressesByCustomerId = async (customerId) => {
  try {
    const [rows] = await db.query(
      `SELECT
        c.CustId_i as customer_id,
        c.CustName_v as customer_name,
        c.CustAbbrev_v as delivery_to,
        cb.CbaAddr1_v as address_line1,
        cb.CbaAddr2_v as address_line2,
        co.CountryName_v as country_name,
        cb.CbastateId_i as state_id,
        s.StateName_v as state_name,
        cb.CbaCity_v as area,
        cb.CbaPostcode_v as postcode,
        cb.CbaPhone_v as phone,
        cb.CbaFax_v as fax,
        cb.CbaContactPerson_v as contact_person,
        cb.CbaEmail_v as email,
        cb.Def_i as is_default,
        cb.Status_i as status,
        co.CountryId_i as country_id
      FROM tbl_customer c
      LEFT JOIN tbl_cust_billaddr cb ON c.CustId_i = cb.CustId_i
      LEFT JOIN tbl_country co ON cb.CountryId_i = co.CountryId_i
      LEFT JOIN tbl_state s ON cb.CountryId_i = s.CountryId_i
      WHERE c.CustId_i = ? AND cb.Status_i != 9
      ORDER BY cb.Def_i DESC, c.CustAbbrev_v ASC`,
      [customerId]
    );
    
    return rows;
  } catch (error) {
    console.error('Error in getDeliveryAddressesByCustomerId model:', error);
    throw error;
  }
};

/**
 * Create a new delivery address
 */
exports.createDeliveryAddress = async (deliveryAddressData) => {
  try {
    const {
      customer_id,
      delivery_to,
      address_line1,
      address_line2 = '',
      country_id,
      state_id,
      area,
      postcode,
      phone,
      fax = '',
      contact_person = '',
      email = '',
      is_default = 0,
      status = 1,
      created_by = 1 // Default user ID if not provided
    } = deliveryAddressData;
    
    const [result] = await db.query(
      `INSERT INTO tbl_cust_billaddr (
        CustId_i, 
        CbaAddr1_v, 
        CbaAddr2_v,
        CountryId_i, 
        CbastateId_i, 
        CbaCity_v, 
        CbaPostcode_v,
        CbaPhone_v, 
        CbaFax_v, 
        CbaContactPerson_v, 
        CbaEmail_v,
        Def_i, 
        Status_i, 
        CreatedBy_i, 
        CreatedDate_dt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        customer_id, 
        address_line1, 
        address_line2,
        country_id, 
        state_id, 
        area, 
        postcode,
        phone, 
        fax, 
        contact_person, 
        email,
        is_default, 
        status, 
        created_by
      ]
    );
    
    return result;
  } catch (error) {
    console.error('Error in createDeliveryAddress model:', error);
    throw error;
  }
};

/**
 * Update a delivery address
 */
exports.updateDeliveryAddress = async (deliveryAddressId, deliveryAddressData) => {
  try {
    const {
      customer_id,
      delivery_to,
      address_line1,
      address_line2 = '',
      country_id,
      state_id,
      area,
      postcode,
      phone,
      fax = '',
      contact_person = '',
      email = '',
      is_default = 0,
      status = 1,
      modified_by = 1 // Default user ID if not provided
    } = deliveryAddressData;
    
    const [result] = await db.query(
      `UPDATE tbl_cust_billaddr SET
        CustId_i = ?,
        CbaAddr1_v = ?,
        CbaAddr2_v = ?,
        CountryId_i = ?,
        CbastateId_i = ?,
        CbaCity_v = ?,
        CbaPostcode_v = ?,
        CbaPhone_v = ?,
        CbaFax_v = ?,
        CbaContactPerson_v = ?,
        CbaEmail_v = ?,
        Def_i = ?,
        Status_i = ?,
        ModifiedBy_i = ?,
        ModifiedDate_dt = NOW()
      WHERE CustBillAddrId_i = ?`,
      [
        customer_id, 
        address_line1, 
        address_line2,
        country_id, 
        state_id, 
        area, 
        postcode,
        phone, 
        fax, 
        contact_person, 
        email,
        is_default, 
        status, 
        modified_by,
        deliveryAddressId
      ]
    );
    
    return result;
  } catch (error) {
    console.error('Error in updateDeliveryAddress model:', error);
    throw error;
  }
};

/**
 * Delete a delivery address (soft delete)
 */
exports.deleteDeliveryAddress = async (deliveryAddressId) => {
  try {
    // Soft delete by setting status to 9
    const [result] = await db.query(
      `UPDATE tbl_cust_billaddr SET
        Status_i = 9,
        ModifiedDate_dt = NOW()
      WHERE CustBillAddrId_i = ?`,
      [deliveryAddressId]
    );
    
    return result;
  } catch (error) {
    console.error('Error in deleteDeliveryAddress model:', error);
    throw error;
  }
};

/**
 * Reset default delivery addresses for a customer
 */
exports.resetDefaultDeliveryAddresses = async (customerId) => {
  try {
    // Set is_default = 0 for all addresses of this customer
    const [result] = await db.query(
      `UPDATE tbl_cust_billaddr SET
        Def_i = 0,
        ModifiedDate_dt = NOW()
      WHERE CustId_i = ? AND Status_i != 9`,
      [customerId]
    );
    
    return result;
  } catch (error) {
    console.error('Error in resetDefaultDeliveryAddresses model:', error);
    throw error;
  }
};

/**
 * Get countries for dropdown
 */
exports.getCountries = async () => {
  try {
    const [rows] = await db.query(
      `SELECT CountryId_i as country_id, CountryName_v as country_name
      FROM tbl_country
      WHERE Status_i = 1
      ORDER BY CountryName_v ASC`
    );
    
    return rows;
  } catch (error) {
    console.error('Error in getCountries model:', error);
    throw error;
  }
};

/**
 * Get states by country for dropdown
 */
exports.getStatesByCountry = async (countryId) => {
  try {
    const [rows] = await db.query(
      `SELECT StateId_i as state_id, StateName_v as state_name
      FROM tbl_state
      WHERE CountryId_i = ? AND Status_i = 1
      ORDER BY StateName_v ASC`,
      [countryId]
    );
    
    return rows;
  } catch (error) {
    console.error('Error in getStatesByCountry model:', error);
    throw error;
  }
};

/**
 * Get customers for dropdown
 */
exports.getCustomers = async () => {
  try {
    const [rows] = await db.query(
      `SELECT CustId_i as customer_id, CustName_v as customer_name
      FROM tbl_customer
      WHERE Status_i = 1
      ORDER BY CustName_v ASC`
    );
    
    return rows;
  } catch (error) {
    console.error('Error in getCustomers model:', error);
    throw error;
  }
};
