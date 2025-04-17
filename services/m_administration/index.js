const express = require('express');
const router = express.Router();
const userRoutes = require('./user/routes/userRoutes');

// Administration landing page route
router.get('/page/administration', (req, res) => {
  res.render('m_administration/administration_landing', { 
    title: 'Administration'
  });
});

module.exports = {
  userRoutes,
  administrationRoutes: router
}; 