const ProcessTypeModel = require('../models/processModel');

/**
 * Process Type Controller - Handles process type management functionality
 */
class ProcessTypeController {
  /**
   * Display process type listing page
   */
  static async processTypeList(req, res) {
    try {
      // Render process type management page with initial data
      res.render('m_administration/process_type/process', {
        title: 'Process Type Management',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in processTypeList:', error);
      res.status(500).render('error', { 
        message: 'Error loading process type management page',
        error: error
      });
    }
  }
  
  /**
   * Display add new process type form
   */
  static async addProcessType(req, res) {
    try {
      res.render('m_administration/process_type/add_process', {
        title: 'Add New Process Type',
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in addProcessType:', error);
      res.status(500).render('error', { 
        message: 'Error loading add process type form',
        error: error
      });
    }
  }
  
  /**
   * Display edit process type form
   */
  static async editProcessType(req, res) {
    try {
      const processTypeId = req.params.id;
      const processType = await ProcessTypeModel.getProcessTypeById(processTypeId);
      
      if (!processType) {
        return res.status(404).render('error', {
          message: 'Process Type not found',
          error: { status: 404 }
        });
      }
      
      res.render('m_administration/process_type/add_process', {
        title: 'Edit Process Type',
        processType: {
          id: processType.ProcesstypeId_i,
          code: processType.ProcesstypeCode_v,
          description: processType.ProcesstypeDescr_v
        },
        user: req.session.user || {}
      });
    } catch (error) {
      console.error('Error in editProcessType:', error);
      res.status(500).render('error', { 
        message: 'Error loading edit process type form',
        error: error
      });
    }
  }
  
  /**
   * API: Get process types
   */
  static async getProcessTypes(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      // Build filters from query parameters
      const filters = {
        page,
        limit,
        code: req.query.code || '',
        description: req.query.description || '',
        sort: req.query.sort || 'id-desc'
      };
      
      // Get process types with pagination
      const processTypes = await ProcessTypeModel.getProcessTypes(filters);
      const total = await ProcessTypeModel.getProcessTypesCount(filters);
      
      // Format for datatable
      const formattedProcessTypes = processTypes.map(pt => {
        return {
          id: pt.ProcesstypeId_i,
          code: pt.ProcesstypeCode_v,
          description: pt.ProcesstypeDescr_v
        };
      });
      
      // Return JSON response
      res.json({
        success: true,
        data: formattedProcessTypes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error in getProcessTypes API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving process types',
        error: error.message
      });
    }
  }
  
  /**
   * API: Get process type by ID
   */
  static async getProcessTypeById(req, res) {
    try {
      const processTypeId = req.params.id;
      const processType = await ProcessTypeModel.getProcessTypeById(processTypeId);
      
      if (!processType) {
        return res.status(404).json({
          success: false,
          message: 'Process Type not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          id: processType.ProcesstypeId_i,
          code: processType.ProcesstypeCode_v,
          description: processType.ProcesstypeDescr_v
        }
      });
    } catch (error) {
      console.error('Error in getProcessTypeById API:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving process type',
        error: error.message
      });
    }
  }
  
  /**
   * API: Create new process type
   */
  static async createProcessType(req, res) {
    try {
      // Validate required fields
      const { code, description } = req.body;
      
      if (!code || !description) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Validate field lengths
      if (code.length < 3 || code.length > 30) {
        return res.status(400).json({
          success: false,
          message: 'Process Type Code must be between 3 and 30 characters'
        });
      }
      
      if (description.length < 3 || description.length > 60) {
        return res.status(400).json({
          success: false,
          message: 'Process Type Description must be between 3 and 60 characters'
        });
      }
      
      // Create process type
      const processTypeData = {
        code,
        description
      };
      
      // Use system userId 1 if user is not logged in
      const userId = req.session?.user?.id || 1;
      const newProcessType = await ProcessTypeModel.createProcessType(processTypeData, userId);
      
      res.status(201).json({
        success: true,
        message: 'Process Type created successfully',
        data: {
          id: newProcessType.id,
          code: newProcessType.code,
          description: newProcessType.description
        }
      });
    } catch (error) {
      console.error('Error in createProcessType API:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating process type',
        error: error.message
      });
    }
  }
  
  /**
   * API: Update process type
   */
  static async updateProcessType(req, res) {
    try {
      const processTypeId = req.params.id;
      
      // Check if process type exists
      const existingProcessType = await ProcessTypeModel.getProcessTypeById(processTypeId);
      if (!existingProcessType) {
        return res.status(404).json({
          success: false,
          message: 'Process Type not found'
        });
      }
      
      // Validate required fields
      const { code, description } = req.body;
      
      if (!code || !description) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Validate field lengths
      if (code.length < 3 || code.length > 30) {
        return res.status(400).json({
          success: false,
          message: 'Process Type Code must be between 3 and 30 characters'
        });
      }
      
      if (description.length < 3 || description.length > 60) {
        return res.status(400).json({
          success: false,
          message: 'Process Type Description must be between 3 and 60 characters'
        });
      }
      
      // Update process type
      const processTypeData = {
        code,
        description
      };
      
      // Use system userId 1 if user is not logged in
      const userId = req.session?.user?.id || 1;
      const updatedProcessType = await ProcessTypeModel.updateProcessType(processTypeId, processTypeData, userId);
      
      res.json({
        success: true,
        message: 'Process Type updated successfully',
        data: {
          id: updatedProcessType.id,
          code: updatedProcessType.code,
          description: updatedProcessType.description
        }
      });
    } catch (error) {
      console.error('Error in updateProcessType API:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating process type',
        error: error.message
      });
    }
  }
  
  /**
   * API: Delete process type
   */
  static async deleteProcessType(req, res) {
    try {
      const processTypeId = req.params.id;
      // Use system userId 1 if user is not logged in
      const userId = req.session?.user?.id || 1;
      
      // Check if process type exists
      const existingProcessType = await ProcessTypeModel.getProcessTypeById(processTypeId);
      if (!existingProcessType) {
        return res.status(404).json({
          success: false,
          message: 'Process Type not found'
        });
      }
      
      // Delete process type
      await ProcessTypeModel.deleteProcessType(processTypeId, userId);
      
      res.json({
        success: true,
        message: 'Process Type deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteProcessType API:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting process type',
        error: error.message
      });
    }
  }
}

module.exports = ProcessTypeController;
