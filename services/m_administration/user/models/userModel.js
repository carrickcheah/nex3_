const pool = require('../../../config/database');
const bcrypt = require('bcryptjs');

/**
 * User Model - Handles database operations for user management
 */
class UserModel {
  /**
   * Get all users with optional filtering
   * @param {Object} filters - Optional filters for the query 
   * @returns {Promise<Array>} - List of users
   */
  static async getUsers(filters = {}) {
    try {
      // Build query
      let query = `
        SELECT u.UserId_i, u.UserName_v, u.UserAbbrev_v, u.UserLogin_v, 
               u.RoleCode_c, r.RoleName_v, u.UserTimeout_v, u.Production_c,
               u.ParentId_i, v.UserAbbrev_v AS ParentAbbrev_v, u.Status_i
        FROM tbl_user u
        LEFT JOIN tbl_role r ON r.RoleCode_c = u.RoleCode_c
        LEFT JOIN tbl_user v ON v.UserId_i = u.ParentId_i
        WHERE 1=1
      `;
      
      const queryParams = [];
      
      // Apply filters if provided
      if (filters.username) {
        query += ` AND u.UserName_v LIKE ?`;
        queryParams.push(`%${filters.username}%`);
      }
      
      if (filters.role) {
        query += ` AND u.RoleCode_c = ?`;
        queryParams.push(filters.role);
      }
      
      if (filters.status) {
        query += ` AND u.Status_i = ?`;
        queryParams.push(filters.status);
      }
      
      // Order by
      query += ` ORDER BY u.UserId_i ASC`;
      
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
      console.error('Error in getUsers:', error);
      throw error;
    }
  }
  
  /**
   * Get count of total users with filters applied
   * @param {Object} filters - Optional filters for the query
   * @returns {Promise<number>} - Total count
   */
  static async getUsersCount(filters = {}) {
    try {
      // Build query
      let query = `
        SELECT COUNT(*) as total
        FROM tbl_user u
        WHERE 1=1
      `;
      
      const queryParams = [];
      
      // Apply filters if provided
      if (filters.username) {
        query += ` AND u.UserName_v LIKE ?`;
        queryParams.push(`%${filters.username}%`);
      }
      
      if (filters.role) {
        query += ` AND u.RoleCode_c = ?`;
        queryParams.push(filters.role);
      }
      
      if (filters.status) {
        query += ` AND u.Status_i = ?`;
        queryParams.push(filters.status);
      }
      
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(query, queryParams);
        return rows[0].total;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getUsersCount:', error);
      throw error;
    }
  }
  
  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User data
   */
  static async getUserById(userId) {
    try {
      const query = `
        SELECT u.UserId_i, u.UserName_v, u.UserAbbrev_v, u.UserLogin_v, 
               u.RoleCode_c, r.RoleName_v, u.UserTimeout_v, u.Production_c,
               u.ParentId_i, v.UserAbbrev_v AS ParentAbbrev_v, u.Status_i
        FROM tbl_user u
        LEFT JOIN tbl_role r ON r.RoleCode_c = u.RoleCode_c
        LEFT JOIN tbl_user v ON v.UserId_i = u.ParentId_i
        WHERE u.UserId_i = ?
      `;
      
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(query, [userId]);
        return rows.length ? rows[0] : null;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getUserById:', error);
      throw error;
    }
  }
  
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user info
   */
  static async createUser(userData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Insert user
      const insertQuery = `
        INSERT INTO tbl_user (
          UserName_v, UserAbbrev_v, UserLogin_v, UserPasswd_v, 
          RoleCode_c, ParentId_i, UserTimeout_v, Status_i
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await connection.query(insertQuery, [
        userData.userName,
        userData.userAbbrev,
        userData.userLogin,
        hashedPassword,
        userData.roleCode,
        userData.parentId || null,
        userData.userTimeout || 30, // Default timeout 30 minutes
        userData.status || 1  // Default status Active (1)
      ]);
      
      await connection.commit();
      
      return {
        userId: result.insertId,
        ...userData
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in createUser:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing user
   * @param {number} userId - User ID
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} - Updated user info
   */
  static async updateUser(userId, userData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Build update query
      let updateQuery = `
        UPDATE tbl_user SET 
          UserName_v = ?,
          UserAbbrev_v = ?,
          UserLogin_v = ?,
          RoleCode_c = ?,
          ParentId_i = ?,
          UserTimeout_v = ?,
          Status_i = ?
      `;
      
      let params = [
        userData.userName,
        userData.userAbbrev,
        userData.userLogin,
        userData.roleCode,
        userData.parentId || null,
        userData.userTimeout || 30,
        userData.status || 'A'
      ];
      
      // If password should be updated
      if (userData.password) {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        updateQuery += `, UserPasswd_v = ?`;
        params.push(hashedPassword);
      }
      
      updateQuery += ` WHERE UserId_i = ?`;
      params.push(userId);
      
      await connection.query(updateQuery, params);
      
      await connection.commit();
      
      return {
        userId: userId,
        ...userData
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error in updateUser:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Delete a user
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteUser(userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Check if user exists
      const [existingUser] = await connection.query(
        'SELECT UserId_i FROM tbl_user WHERE UserId_i = ?',
        [userId]
      );
      
      if (!existingUser.length) {
        throw new Error('User not found');
      }
      
      // Delete user
      await connection.query('DELETE FROM tbl_user WHERE UserId_i = ?', [userId]);
      
      await connection.commit();
      
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Error in deleteUser:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get all roles for dropdown
   * @returns {Promise<Array>} - List of roles
   */
  static async getRoles() {
    try {
      const query = `
        SELECT RoleCode_c, RoleName_v 
        FROM tbl_role
        ORDER BY RoleName_v
      `;
      
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query(query);
        return rows;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error in getRoles:', error);
      throw error;
    }
  }
}

module.exports = UserModel; 