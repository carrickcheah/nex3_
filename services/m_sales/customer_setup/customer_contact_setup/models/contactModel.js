const pool = require('../../../../config/database');
const moment = require('moment');

/**
 * Customer Contact Model - Database operations for customer contacts
 */
class ContactModel {
  /**
   * Get all customer contacts with pagination and filtering
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} List of customer contacts
   */
  static async getContacts(filters = {}) {
    const connection = await pool.getConnection();
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;
      
      const searchTerms = [];
      const queryParams = [];
      
      // Base query - using the exact provided SQL structure
      let sql = `
        SELECT
            c.CustName_v as "customer",
            c.IntId_v as "internal id",
            cc.CctContact_v as "contact person",
            cc.CctDesignation_v as "designation",
            cc.CctTel1_v as "tel no 1",
            cc.CctTel2_v as "tel no 2",
            cc.CctEmail_v as "email address",
            cc.__Def_i as "default",
            cc.Status_i as "status"
        FROM tbl_customer c
        LEFT JOIN tbl_cct_cust cct ON c.CustId_i = cct.CustId_i
        LEFT JOIN tbl_cust_contact cc ON cct.CctId_i = cc.CctId_i
      `;
      
      // Add search filters
      if (filters.search) {
        const search = `%${filters.search}%`;
        searchTerms.push(`(
          c.CustName_v LIKE ? OR 
          c.IntId_v LIKE ? OR 
          cc.CctContact_v LIKE ? OR
          cc.CctDesignation_v LIKE ? OR
          cc.CctTel1_v LIKE ? OR
          cc.CctEmail_v LIKE ?
        )`);
        queryParams.push(search, search, search, search, search, search);
      }
      
      if (filters.customerId) {
        searchTerms.push('c.CustId_i = ?');
        queryParams.push(filters.customerId);
      }
      
      if (filters.status !== undefined) {
        searchTerms.push('cc.Status_i = ?');
        queryParams.push(filters.status);
      }
      
      // Combine search terms
      if (searchTerms.length > 0) {
        sql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      // Add ORDER BY based on sort parameters
      const sortField = filters.sort || 'customer';
      const sortOrder = filters.order || 'asc';
      
      // Map frontend sort fields to database columns
      const sortMapping = {
        'seq_no': 'c.CustId_i',
        'customer': 'c.CustName_v',
        'internal_id': 'c.IntId_v',
        'contact_person': 'cc.CctContact_v',
        'designation': 'cc.CctDesignation_v',
        'tel_no_1': 'cc.CctTel1_v',
        'tel_no_2': 'cc.CctTel2_v',
        'email_address': 'cc.CctEmail_v',
        'default': 'cc.Status_i',
        'status': 'c.Status_i'
      };
      
      // Use the mapped column or fallback to customer name if mapping not found
      const orderByColumn = sortMapping[sortField] || 'c.CustName_v';
      sql += ` ORDER BY ${orderByColumn} ${sortOrder.toUpperCase()}`; 
      
      // Add secondary sort by customer name if not already sorting by it
      if (orderByColumn !== 'c.CustName_v') {
        sql += ', c.CustName_v ASC';
      }
      
      // Add pagination limit
      sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [rows] = await connection.execute(sql, queryParams);
      
      // Get total count for pagination
      let countSql = `
        SELECT COUNT(*) as total 
        FROM tbl_customer c
        LEFT JOIN tbl_cust_contact cc ON c.CustId_i = cc.CctId_i
      `;
      
      if (searchTerms.length > 0) {
        countSql += ' WHERE ' + searchTerms.join(' AND ');
      }
      
      const [countResult] = await connection.execute(countSql, queryParams);
      const total = countResult[0].total;
      
      return {
        contacts: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error in getContacts:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get a contact by ID
   * @param {number} contactId - Contact ID
   * @returns {Promise<Object>} Contact details
   */
  static async getContactById(contactId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          cc.ContactId_i as contact_id,
          cc.CustId_i as customer_id,
          c.CustName_v as customer_name,
          cc.IntId_v as internal_id,
          cc.Title_v as title,
          cc.ContactPerson_v as contact_person,
          cc.Designation_v as designation,
          cc.TelNo1_v as tel_no_1,
          cc.TelNo2_v as tel_no_2,
          cc.EmailAddr_v as email_address,
          cc.IsDefault_i as is_default,
          cc.Status_i as status,
          cc.CreateId_i as create_id,
          cc.CreateDate_dt as created_date,
          cu.UserName_v as created_by,
          cc.UpdateId_i as update_id,
          cc.UpdateDate_dt as updated_date,
          uu.UserName_v as updated_by
        FROM tbl_customer_contact cc
        LEFT JOIN tbl_customer c ON c.CustId_i = cc.CustId_i
        LEFT JOIN tbl_user cu ON cu.UserId_i = cc.CreateId_i
        LEFT JOIN tbl_user uu ON uu.UserId_i = cc.UpdateId_i
        WHERE cc.ContactId_i = ?`,
        [contactId]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error in getContactById:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Create a new customer contact
   * @param {Object} data - Contact data
   * @returns {Promise<Object>} Created contact with ID
   */
  static async createContact(data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // If setting this contact as default, unset any existing default for this customer
      if (data.is_default) {
        await connection.execute(
          'UPDATE tbl_customer_contact SET IsDefault_i = 0 WHERE CustId_i = ?',
          [data.customer_id]
        );
      }
      
      const [result] = await connection.execute(
        `INSERT INTO tbl_customer_contact (
          CustId_i, IntId_v, Title_v, ContactPerson_v, Designation_v,
          TelNo1_v, TelNo2_v, EmailAddr_v, IsDefault_i, Status_i,
          CreateId_i, CreateDate_dt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          data.customer_id,
          data.internal_id || '',
          data.title || '',
          data.contact_person,
          data.designation || '',
          data.tel_no_1 || '',
          data.tel_no_2 || '',
          data.email_address || '',
          data.is_default ? 1 : 0,
          data.status || 1,
          data.created_by || 1
        ]
      );
      
      await connection.commit();
      
      const contactId = result.insertId;
      
      return {
        contact_id: contactId,
        message: 'Contact created successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in createContact:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing customer contact
   * @param {number} contactId - Contact ID
   * @param {Object} data - Updated contact data
   * @returns {Promise<Object>} Updated contact
   */
  static async updateContact(contactId, data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // If setting this contact as default, unset any existing default for this customer
      if (data.is_default) {
        await connection.execute(
          'UPDATE tbl_customer_contact SET IsDefault_i = 0 WHERE CustId_i = ? AND ContactId_i != ?',
          [data.customer_id, contactId]
        );
      }
      
      await connection.execute(
        `UPDATE tbl_customer_contact SET
          CustId_i = ?,
          IntId_v = ?,
          Title_v = ?,
          ContactPerson_v = ?,
          Designation_v = ?,
          TelNo1_v = ?,
          TelNo2_v = ?,
          EmailAddr_v = ?,
          IsDefault_i = ?,
          Status_i = ?,
          UpdateId_i = ?,
          UpdateDate_dt = NOW()
        WHERE ContactId_i = ?`,
        [
          data.customer_id,
          data.internal_id || '',
          data.title || '',
          data.contact_person,
          data.designation || '',
          data.tel_no_1 || '',
          data.tel_no_2 || '',
          data.email_address || '',
          data.is_default ? 1 : 0,
          data.status,
          data.updated_by || 1,
          contactId
        ]
      );
      
      await connection.commit();
      
      return {
        contact_id: contactId,
        message: 'Contact updated successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in updateContact:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Delete a customer contact
   * @param {number} contactId - Contact ID
   * @returns {Promise<Object>} Result of the deletion
   */
  static async deleteContact(contactId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Check if contact exists
      const [rows] = await connection.execute(
        'SELECT ContactId_i, IsDefault_i, CustId_i FROM tbl_customer_contact WHERE ContactId_i = ?',
        [contactId]
      );
      
      if (rows.length === 0) {
        throw new Error('Contact not found');
      }
      
      const contact = rows[0];
      
      // Delete the contact
      await connection.execute(
        'DELETE FROM tbl_customer_contact WHERE ContactId_i = ?',
        [contactId]
      );
      
      // If it was the default contact, set another contact as default
      if (contact.IsDefault_i === 1) {
        const [otherContacts] = await connection.execute(
          'SELECT ContactId_i FROM tbl_customer_contact WHERE CustId_i = ? LIMIT 1',
          [contact.CustId_i]
        );
        
        if (otherContacts.length > 0) {
          await connection.execute(
            'UPDATE tbl_customer_contact SET IsDefault_i = 1 WHERE ContactId_i = ?',
            [otherContacts[0].ContactId_i]
          );
        }
      }
      
      await connection.commit();
      
      return {
        success: true,
        message: 'Contact deleted successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in deleteContact:', error);
      throw error;
    } finally {
      connection.release();
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

module.exports = ContactModel;