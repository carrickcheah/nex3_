const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

// Redirect routes
router.get('/page/sales/customer_delivery_address', (req, res) => {
    res.redirect('/page/sales/delivery-address');
});

// Page routes - render views
router.get('/page/sales/delivery-address', deliveryController.renderDeliveryAddressesPage);
router.get('/page/sales/delivery-address/add', deliveryController.renderAddDeliveryAddressPage);
router.get('/page/sales/delivery-address/edit/:id', deliveryController.renderEditDeliveryAddressPage);
router.get('/page/sales/delivery-address/view/:id', deliveryController.renderViewDeliveryAddressPage);

// API routes - data operations
router.get('/api/sales/delivery-address', deliveryController.getDeliveryAddresses);
router.get('/api/sales/delivery-address/:id', deliveryController.getDeliveryAddressById);
router.post('/api/sales/delivery-address', deliveryController.createDeliveryAddress);
router.put('/api/sales/delivery-address/:id', deliveryController.updateDeliveryAddress);
router.delete('/api/sales/delivery-address/:id', deliveryController.deleteDeliveryAddress);

// Additional API routes for related data
router.get('/api/sales/delivery-address/customer/:customerId', deliveryController.getCustomerDeliveryAddresses);
router.get('/api/sales/countries', deliveryController.getCountries);
router.get('/api/sales/countries/:countryId/states', deliveryController.getStatesByCountry);

module.exports = router;
