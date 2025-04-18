const express = require('express');
const router = express.Router();
const InstructionController = require('../controllers/instructionController');

// Web Routes - HTML Pages
router.get('/page/sales/sdi_inquiry', InstructionController.instructionList);
router.get('/page/sales/sdi_inquiry/add', InstructionController.addInstruction);
router.get('/page/sales/sdi_inquiry/edit/:id', InstructionController.editInstruction);
router.get('/page/sales/sdi_inquiry/view/:id', InstructionController.viewInstruction);

// Additional route with hyphenated URL (both formats supported)
router.get('/page/sales/delivery-instructions', InstructionController.instructionList);
router.get('/page/sales/delivery-instructions/add', InstructionController.addInstruction);
router.get('/page/sales/delivery-instructions/edit/:id', InstructionController.editInstruction);
router.get('/page/sales/delivery-instructions/view/:id', InstructionController.viewInstruction);

// API Routes - JSON Data
router.get('/api/sales/sdi_instructions', InstructionController.getDeliveryInstructions);
router.get('/api/sales/sdi_instructions/:id', InstructionController.getDeliveryInstructionById);
router.post('/api/sales/sdi_instructions', InstructionController.createDeliveryInstruction);
router.put('/api/sales/sdi_instructions/:id', InstructionController.updateDeliveryInstruction);
router.get('/api/sales/sdi_docref', InstructionController.generateDocRef);
router.get('/api/sales/sdi_test', InstructionController.testConnection);

module.exports = router;
