const express = require('express');
const router = express.Router();

// Warehouse landing page route
router.get('/page/warehouse', (req, res) => {
  res.render('m_warehouse/warehouse_landing', { 
    title: 'Warehouse'
  });
});

module.exports = {
  warehouseRoutes: router
}; 