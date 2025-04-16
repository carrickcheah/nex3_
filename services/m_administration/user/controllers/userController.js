const UserModel = require('../models/userModel');

/**
 * User Controller - Handles user management functionality
 */
class UserController {
  /**
   * Display user listing page 
   */
  static async userSetupDisplay(req, res) {
    try {
      // Get roles for dropdown
      const roles = await UserModel.getRoles();
      
      // Render user management page with initial data
      res.render('m_administration/user/user_setup_display', {
        title: 'User Administration',
        roles: roles,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in userSetupDisplay:', error);
      res.status(500).render('error', { 
        message: 'Error loading user management page',
        error: error
      });
    }
  }
  
  /**
   * Display add new user form
   */
  static async addNewUser(req, res) {
    try {
      // Get roles for dropdown
      const roles = await UserModel.getRoles();
      
      // Get managers (users with parent role) for reporting dropdown
      const managers = await UserModel.getUsers({ role: 'MANAGER' });
      
      res.render('m_administration/user/add_new_user', {
        title: 'Add New User',
        roles: roles,
        managers: managers,
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in addNewUser:', error);
      res.status(500).render('error', { 
        message: 'Error loading add user form',
        error: error
      });
    }
  }
  
  /**
   * API: Get users
   */
  static async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      // Build filters from query parameters
      const filters = {
        page,
        limit,
        username: req.query.username || '',
        role: req.query.role || '',
        status: req.query.status || ''
      };
      
      // Get users with pagination
      const users = await UserModel.getUsers(filters);
      const total = await UserModel.getUsersCount(filters);
      
      // Format for datatable
      const formattedUsers = users.map(user => {
        return {
          id: user.UserId_i,
          userName: user.UserName_v,
          userAbbrev: user.UserAbbrev_v,
          userLogin: user.UserLogin_v,
          roleCode: user.RoleCode_c,
          roleName: user.RoleName_v,
          parentId: user.ParentId_i,
          parentName: user.ParentAbbrev_v,
          isOperator: user.Production_c === '1' ? 'Yes' : 'No',
          status: user.Status_i === 1 ? 'Active' : 'Inactive',
          statusCode: user.Status_i
        };
      });
      
      // Return JSON response
      res.json({
        success: true,
        data: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getUsers API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving users',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get user by ID
   */
  static async getUserById(req, res) {
    try {
      const userId = req.params.id;
      const user = await UserModel.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          id: user.UserId_i,
          userName: user.UserName_v,
          userAbbrev: user.UserAbbrev_v,
          userLogin: user.UserLogin_v,
          roleCode: user.RoleCode_c,
          roleName: user.RoleName_v,
          parentId: user.ParentId_i,
          parentName: user.ParentAbbrev_v,
          status: user.Status_i
        }
      });
    } catch (error) {
      console.error('Error in getUserById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving user',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new user
   */
  static async createUser(req, res) {
    try {
      // Validate required fields
      const { userName, userAbbrev, userLogin, password, roleCode } = req.body;
      
      if (!userName || !userAbbrev || !userLogin || !password || !roleCode) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Create user
      const userData = {
        userName,
        userAbbrev,
        userLogin,
        password,
        roleCode,
        parentId: req.body.parentId,
        userTimeout: req.body.userTimeout || 30,
        status: req.body.status || 'A'
      };
      
      const newUser = await UserModel.createUser(userData);
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: newUser.userId,
          userName: newUser.userName,
          userAbbrev: newUser.userAbbrev,
          roleCode: newUser.roleCode
        }
      });
    } catch (error) {
      console.error('Error in createUser API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update user
   */
  static async updateUser(req, res) {
    try {
      const userId = req.params.id;
      
      // Validate required fields
      const { userName, userAbbrev, userLogin, roleCode } = req.body;
      
      if (!userName || !userAbbrev || !userLogin || !roleCode) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Update user
      const userData = {
        userName,
        userAbbrev,
        userLogin,
        roleCode,
        parentId: req.body.parentId,
        userTimeout: req.body.userTimeout,
        status: req.body.status
      };
      
      // Only include password if it's being changed
      if (req.body.password) {
        userData.password = req.body.password;
      }
      
      const updatedUser = await UserModel.updateUser(userId, userData);
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          id: updatedUser.userId,
          userName: updatedUser.userName,
          userAbbrev: updatedUser.userAbbrev,
          roleCode: updatedUser.roleCode
        }
      });
    } catch (error) {
      console.error('Error in updateUser API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user',
        error: error.message
      });
    }
  }
  
  /**
   * API: Delete user
   */
  static async deleteUser(req, res) {
    try {
      const userId = req.params.id;
      
      await UserModel.deleteUser(userId);
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteUser API:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get roles
   */
  static async getRoles(req, res) {
    try {
      const roles = await UserModel.getRoles();
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Error in getRoles API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving roles',
        error: error.message
      });
    }
  }
}

module.exports = UserController; 