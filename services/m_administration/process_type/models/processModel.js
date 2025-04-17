const pool = require('../../../config/database');

/**
 * ProcessType Model - Handles database operations for process type management
 */
class ProcessTypeModel {
  /**
   * Get all process types with optional filtering
   * @param {Object} filters - Optional filters for the query 
   * @returns {Promise<Array>} - List of process types
   */
  static async getProcessTypes(filters = {}) {
    try {
      // Build query
      let query = `
        SELECT 
          ProcesstypeId_i, 
          ProcesstypeCode_v, 
          ProcesstypeDescr_v,
          CreateId_i,
          UpdateId_i
        FROM tbl_process_type
        WHERE 1=1
      `;
      
      const queryParams = [];
      
      // Apply filters if provided
      if (filters.code) {
        query += ` AND ProcesstypeCode_v LIKE ?`;
        queryParams.push(`%${filters.code}%`);
      }
      
      if (filters.description) {
        query += ` AND ProcesstypeDescr_v LIKE ?`;
        queryParams.push(`%${filters.description}%`);
      }
      
      // Order by
      if (filters.sort) {
        const [field, direction] = filters.sort.split('-');
        const sortMap = {
          'id': 'ProcesstypeId_i',
          'code': 'ProcesstypeCode_v',
          'description': 'ProcesstypeDescr_v'
        };
        
        if (sortMap[field]) {
          query += ` ORDER BY ${sortMap[field]} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
        } else {
          query += ` ORDER BY ProcesstypeId_i DESC`;
        }
      } else {
        query += ` ORDER BY ProcesstypeId_i DESC`;
      }
      
      // Pagination
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        query += ` LIMIT ?, ?`;
        queryParams.push(offset, parseInt(filters.limit));
      }
      
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(query, queryParams);
        return rows;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getProcessTypes:', error);
      throw error;
    }
  }
  
  /**
   * Get count of total process types with filters applied
   * @param {Object} filters - Optional filters for the query
   * @returns {Promise<number>} - Total count
   */
  static async getProcessTypesCount(filters = {}) {
    try {
      // Build query
      let query = `
        SELECT COUNT(*) as total
        FROM tbl_process_type
        WHERE 1=1
      `;
      
      const queryParams = [];
      
      // Apply filters if provided
      if (filters.code) {
        query += ` AND ProcesstypeCode_v LIKE ?`;
        queryParams.push(`%${filters.code}%`);
      }
      
      if (filters.description) {
        query += ` AND ProcesstypeDescr_v LIKE ?`;
        queryParams.push(`%${filters.description}%`);
      }
      
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(query, queryParams);
        return rows[0].total;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getProcessTypesCount:', error);
      throw error;
    }
  }
  
  /**
   * Get process type by ID
   * @param {number} id - Process Type ID
   * @returns {Promise<Object>} - Process Type data
   */
  static async getProcessTypeById(id) {
    try {
      const query = `
        SELECT 
          ProcesstypeId_i, 
          ProcesstypeCode_v, 
          ProcesstypeDescr_v,
          CreateId_i,
          UpdateId_i
        FROM tbl_process_type
        WHERE ProcesstypeId_i = ?
      `;
      
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(query, [id]);
        return rows.length ? rows[0] : null;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getProcessTypeById:', error);
      throw error;
    }
  }
  
  /**
   * Create a new process type
   * @param {Object} data - Process type data
   * @param {number} userId - User ID performing the action
   * @returns {Promise<Object>} - Created process type info
   */
  static async createProcessType(data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Insert process type
      const insertQuery = `
        INSERT INTO tbl_process_type (
          ProcesstypeCode_v,
          ProcesstypeDescr_v,
          CreateId_i,
          UpdateId_i
        ) VALUES (?, ?, ?, ?)
      `;
      
      const [result] = await connection.query(insertQuery, [
        data.code,
        data.description,
        userId,
        userId
      ]);
      
      const processTypeId = result.insertId;
      
      // Copy to history table
      await connection.query(`
        INSERT INTO his_process_type 
        SELECT * FROM tbl_process_type 
        WHERE ProcesstypeId_i = ?
      `, [processTypeId]);
      
      await connection.commit();
      
      return {
        id: processTypeId,
        code: data.code,
        description: data.description,
        createId: userId,
        updateId: userId
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in createProcessType:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing process type
   * @param {number} id - Process Type ID
   * @param {Object} data - Process Type data to update
   * @param {number} userId - User ID performing the action
   * @returns {Promise<Object>} - Updated process type info
   */
  static async updateProcessType(id, data, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Update process type
      const updateQuery = `
        UPDATE tbl_process_type SET 
          ProcesstypeCode_v = ?,
          ProcesstypeDescr_v = ?,
          UpdateId_i = ?
        WHERE ProcesstypeId_i = ?
      `;
      
      await connection.query(updateQuery, [
        data.code,
        data.description,
        userId,
        id
      ]);
      
      // Copy to history table
      await connection.query(`
        INSERT INTO his_process_type 
        SELECT * FROM tbl_process_type 
        WHERE ProcesstypeId_i = ?
      `, [id]);
      
      await connection.commit();
      
      return {
        id: id,
        code: data.code,
        description: data.description,
        updateId: userId
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in updateProcessType:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Delete a process type
   * @param {number} id - Process Type ID
   * @param {number} userId - User ID performing the action
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteProcessType(id, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Check if process type exists
      const [existingProcessType] = await connection.query(
        'SELECT ProcesstypeId_i FROM tbl_process_type WHERE ProcesstypeId_i = ?',
        [id]
      );
      
      if (!existingProcessType.length) {
        throw new Error('Process Type not found');
      }
      
      // Copy to history table before deleting
      await connection.query(`
        INSERT INTO his_process_type 
        SELECT * FROM tbl_process_type 
        WHERE ProcesstypeId_i = ?
      `, [id]);
      
      // Delete process type
      await connection.query('DELETE FROM tbl_process_type WHERE ProcesstypeId_i = ?', [id]);
      
      await connection.commit();
      
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error in deleteProcessType:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ProcessTypeModel; 