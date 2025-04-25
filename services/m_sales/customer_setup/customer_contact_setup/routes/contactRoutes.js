const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/contactController');

// Page routes
// List contacts
router.get('/', (req, res) => {
  res.render('m_sales/customer_setup/customer_contact_setup/table_view_contact_setup', {
    pageTitle: 'Customer Contact Setup',
    title: 'Customer Contact Setup',
    user: req.session.user || {}
  });
});

// Add contact page
router.get('/add', (req, res) => {
  res.render('m_sales/customer_setup/customer_contact_setup/add_contact', {
    pageTitle: 'Add Customer Contact',
    title: 'Customer Contact Setup',
    user: req.session.user || {}
  });
});

// Edit contact page
router.get('/edit/:id', (req, res) => {
  const contactId = req.params.id;
  res.render('m_sales/customer_setup/customer_contact_setup/edit_contact', {
    pageTitle: 'Edit Customer Contact',
    title: 'Customer Contact Setup',
    user: req.session.user || {},
    contactId
  });
});

// API routes
// Get all contacts with pagination and filtering
router.get('/contacts', ContactController.getContacts);

// Get a single contact by ID
router.get('/contact/:id', ContactController.getContactById);

// Create a new contact
router.post('/contact', ContactController.createContact);

// Update an existing contact
router.put('/contact/:id', ContactController.updateContact);

// Delete a contact
router.delete('/contact/:id', ContactController.deleteContact);

// Get all customers for dropdown (temporary - normally from customer controller)
router.get('/customers', async (req, res) => {
  try {
    const pool = require('../../../../config/database');
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT CustId_i as customer_id, CustName_v as customer_name FROM tbl_customer WHERE Status_i = 1 ORDER BY CustName_v'
      );
      
      res.json({
        success: true,
        data: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
});

module.exports = router;