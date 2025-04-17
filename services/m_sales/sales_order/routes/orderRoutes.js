const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');

// Test route
router.get('/api/sales/test', (req, res) => {
  console.log('Test API endpoint called');
  return res.status(200).json({
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString()
  });
});

// Web routes (page rendering)
router.get('/page/sales/orders', OrderController.orderList);
router.get('/page/sales/order/add', OrderController.addOrder);
router.get('/page/sales/order/edit/:id', OrderController.editOrder);
router.get('/page/sales/order/view/:id', OrderController.viewOrder);

// API routes
router.get('/api/sales/orders', OrderController.getSalesOrders);
router.get('/api/sales/orders/:id', OrderController.getSalesOrderById);
router.post('/api/sales/orders', OrderController.createSalesOrder);
router.put('/api/sales/orders/:id', OrderController.updateSalesOrder);

// Support API routes
router.get('/api/sales/customer/:id/addresses', OrderController.getCustomerAddresses);
router.get('/api/sales/products', OrderController.getProducts);
router.get('/api/sales/docref', OrderController.generateDocRef);

module.exports = router;
