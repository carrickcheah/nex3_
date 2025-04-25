const ContactModel = require('../models/contactModel');

/**
 * Customer Contact Controller - Handles API endpoints for customer contacts
 */
class ContactController {
  /**
   * Get all contacts with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getContacts(req, res) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        search: req.query.search || '',
        status: req.query.status !== undefined ? parseInt(req.query.status) : undefined,
        customerId: req.query.customer_id ? parseInt(req.query.customer_id) : undefined,
        sort: req.query.sort || 'customer',
        order: req.query.order || 'asc'
      };
      
      const result = await ContactModel.getContacts(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getContacts controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch contacts',
        error: error.message
      });
    }
  }
  
  /**
   * Get a single contact by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getContactById(req, res) {
    try {
      const contactId = parseInt(req.params.id);
      
      if (isNaN(contactId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }
      
      const contact = await ContactModel.getContactById(contactId);
      
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }
      
      res.json({
        success: true,
        data: contact
      });
    } catch (error) {
      console.error('Error in getContactById controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch contact',
        error: error.message
      });
    }
  }
  
  /**
   * Create a new contact
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createContact(req, res) {
    try {
      const contactData = req.body;
      
      // Validate required fields
      if (!contactData.customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required'
        });
      }
      
      if (!contactData.contact_person) {
        return res.status(400).json({
          success: false,
          message: 'Contact person name is required'
        });
      }
      
      // Add user info if available
      if (req.session && req.session.user) {
        contactData.created_by = req.session.user.id;
      }
      
      const result = await ContactModel.createContact(contactData);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Contact created successfully'
      });
    } catch (error) {
      console.error('Error in createContact controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create contact',
        error: error.message
      });
    }
  }
  
  /**
   * Update an existing contact
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateContact(req, res) {
    try {
      const contactId = parseInt(req.params.id);
      const contactData = req.body;
      
      if (isNaN(contactId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }
      
      // Validate required fields
      if (!contactData.customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required'
        });
      }
      
      if (!contactData.contact_person) {
        return res.status(400).json({
          success: false,
          message: 'Contact person name is required'
        });
      }
      
      // Add user info if available
      if (req.session && req.session.user) {
        contactData.updated_by = req.session.user.id;
      }
      
      const result = await ContactModel.updateContact(contactId, contactData);
      
      res.json({
        success: true,
        data: result,
        message: 'Contact updated successfully'
      });
    } catch (error) {
      console.error('Error in updateContact controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update contact',
        error: error.message
      });
    }
  }
  
  /**
   * Delete a contact
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteContact(req, res) {
    try {
      const contactId = parseInt(req.params.id);
      
      if (isNaN(contactId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }
      
      const result = await ContactModel.deleteContact(contactId);
      
      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteContact controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete contact',
        error: error.message
      });
    }
  }
}

module.exports = ContactController;