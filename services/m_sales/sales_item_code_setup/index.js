const express = require('express');
const router = express.Router();

// Import submodule routers - these will be added as they're created
// const itemCodeRoutes = require('./item_code/routes/itemCodeRoutes');
// const itemCategoryRoutes = require('./item_category/routes/categoryRoutes');
// const itemClassRoutes = require('./item_class/routes/classRoutes');

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

// Mount submodule routes when they're created
// router.use('/', itemCodeRoutes);
// router.use('/', itemCategoryRoutes);
// router.use('/', itemClassRoutes);

module.exports = router;
