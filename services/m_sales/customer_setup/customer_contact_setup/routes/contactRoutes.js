const express = require('express');
const router = express.Router();

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

module.exports = router;