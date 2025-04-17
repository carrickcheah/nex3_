const express = require('express');
const router = express.Router();
const userRoutes = require('./user/routes/userRoutes');
const processRoutes = require('./process_type/routes/processRoutes');

// Administration landing page route
router.get('/page/administration', (req, res) => {
  res.render('m_administration/administration_landing', { 
    title: 'Administration'
  });
});

// Register routes
router.use('/', processRoutes);
router.use('/', userRoutes);

module.exports = {
  userRoutes,
  processRoutes,
  administrationRoutes: router
}; 