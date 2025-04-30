const express = require('express');
const router = express.Router();

// Import submodule routers
// const stockCodeRoutes = require('./sales_stock/routes/sales_stockRoutes'); // Removed - Handled in parent router
// const salesServiceRoutes = require('./sales_service/routes/sales_serviceRoutes'); // Removed - Handled in parent router

// Dashboard route
router.get('/', (req, res) => {
  res.render('m_sales/sales_item_code_setup/code_dashboard', {
    pageTitle: 'Item Code Setup Dashboard',
    title: 'Sales',
    user: req.session.user || {}
  });
});

// Alternative route
router.get('/code_dashboard', (req, res) => {
  res.render('m_sales/sales_item_code_setup/code_dashboard', {
    pageTitle: 'Item Code Dashboard',
    title: 'Sales',
    user: req.session.user || {}
  });
});

// Mount submodule routes
// router.use('/', stockCodeRoutes); // Removed - Handled in parent router

module.exports = router;