const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

// Web routes (page rendering)
router.get('/page/administration/user_setup_display', UserController.userSetupDisplay);
router.get('/page/administration/user/add', UserController.addNewUser);

// API routes
router.get('/api/users', UserController.getUsers);
router.get('/api/users/:id', UserController.getUserById);
router.post('/api/users', UserController.createUser);
router.put('/api/users/:id', UserController.updateUser);
router.delete('/api/users/:id', UserController.deleteUser);

// Support APIs
router.get('/api/roles', UserController.getRoles);

module.exports = router; 