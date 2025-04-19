const express = require('express');
const router = express.Router();
const DeliveryOrderController = require('../controllers/delivery_orderController');

// Web Routes - HTML Pages
router.get('/page/sales/delivery-orders', DeliveryOrderController.deliveryOrderList);
router.get('/page/sales/delivery-orders/view/:id', DeliveryOrderController.viewDeliveryOrder);

// Additional route with shorter URL
router.get('/page/sales/delivery', DeliveryOrderController.deliveryOrderList);

// API Routes - JSON Data
router.get('/api/sales/delivery-orders', DeliveryOrderController.getDeliveryOrders);
router.get('/api/sales/delivery-orders/:id', DeliveryOrderController.getDeliveryOrderById);
router.post('/api/sales/delivery-orders', DeliveryOrderController.createDeliveryOrder);
router.put('/api/sales/delivery-orders/:id', DeliveryOrderController.updateDeliveryOrder);
router.get('/api/sales/delivery-orders/docref/generate', DeliveryOrderController.generateDocRef);
router.get('/api/sales/delivery-orders/test/connection', DeliveryOrderController.testConnection);

module.exports = router;
