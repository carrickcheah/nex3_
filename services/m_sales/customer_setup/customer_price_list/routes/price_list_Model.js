const express = require('express');
const router = express.Router();
const priceController = require('../controllers/price_list_Controller');

// Web routes (render views)
router.get('/page/sales/customer_price_list', priceController.renderPriceListPage);
router.get('/page/sales/customer_price_list/add', priceController.renderAddPriceListPage);
router.get('/page/sales/customer_price_list/edit/:id', priceController.renderEditPriceListPage);
router.get('/page/sales/customer_price_list/view/:id', priceController.renderViewPriceListPage);

// API routes (return JSON)
router.get('/api/sales/customer_price_list', priceController.getPriceList);
router.get('/api/sales/customer_price_list/:id', priceController.getPriceListItem);
router.post('/api/sales/customer_price_list', priceController.createPriceListItem);
router.put('/api/sales/customer_price_list/:id', priceController.updatePriceListItem);
router.delete('/api/sales/customer_price_list/:id', priceController.deletePriceListItem);

module.exports = router; 