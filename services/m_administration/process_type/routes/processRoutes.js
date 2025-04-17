const express = require('express');
const router = express.Router();
const ProcessTypeController = require('../controllers/processController');

// Web routes (page rendering)
router.get('/page/administration/process_types', ProcessTypeController.processTypeList);
router.get('/page/administration/process_type/add', ProcessTypeController.addProcessType);
router.get('/page/administration/process_type/edit/:id', ProcessTypeController.editProcessType);

// API routes
router.get('/api/process-types', ProcessTypeController.getProcessTypes);
router.get('/api/process-types/:id', ProcessTypeController.getProcessTypeById);
router.post('/api/process-types', ProcessTypeController.createProcessType);
router.put('/api/process-types/:id', ProcessTypeController.updateProcessType);
router.delete('/api/process-types/:id', ProcessTypeController.deleteProcessType);

module.exports = router;
