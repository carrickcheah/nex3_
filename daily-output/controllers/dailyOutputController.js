const pool = require('../config/database');
const moment = require('moment');
const helpers = require('../helpers/dateHelpers');
const DailyOutputModel = require('../models/dailyOutputModel');

// Constants
const OPTION_DAILY_PURPOSE = {
  'S': 'Normal Output',
  'X': 'Manual Goods',
  'M': 'Manually Close'
};

/**
 * Creates a new daily output record
 */
exports.dailyOutputNew = async (req, res) => {
  try {
    const dbData = {
      purpose: 'S', // Default = Normal Output
      no_activity_log: 'redirect'
    };
    
    // Clear session data for this transaction
    const txn_mode = 'daily_new';
    req.session[txn_mode] = {};
    
    // Set session data
    req.session[txn_mode] = {
      site_id: req.session.user?.site_id || 1,
      txntype_id: 25, // Daily Output, Finished Goods
      item_ids: [],
      items_list: [],
      session_key: Date.now().toString()
    };
    
    // Set default data
    const sqlDate = moment().format('YYYY-MM-DD');
    
    dbData.title = 'New Daily Output';
    dbData.heading = 'VALIANT PRECISION SDN BHD';
    dbData.input_table_rows = '';
    dbData.output_table_rows = '';
    dbData.tool_table_rows = '';
    dbData.session_key = req.session[txn_mode].session_key;
    dbData.txn_mode = txn_mode;
    dbData.txntype_id = 25;
    dbData.txn_id = 0;
    dbData.update_key = 0;
    dbData.action_key = helpers.keyHelper(dbData.txn_id, dbData.txn_mode);
    dbData.input_loc = '';
    dbData.output_loc = '';
    dbData.wc = 'WC';
    dbData.void = '0';
    dbData.allow_void = '1';
    
    // Auto date and reference
    dbData.txn_date = moment().format('DD-MM-YYYY');
    dbData.doc_ref = await DailyOutputModel.generateDocReference(dbData);
    req.session[txn_mode].sql_date = sqlDate;
    
    // Get required data for dropdowns
    let products = [], machines = [], molds = [], tools = [], operators = [];
    
    try {
      // Get empty data for new records
      machines = await DailyOutputModel.getMachinesById(0);
      molds = await DailyOutputModel.getMoldsById(0);
      tools = await DailyOutputModel.getToolsById(0);
      operators = await DailyOutputModel.getOperatorsById(0);
      products = await DailyOutputModel.getAvailableProducts();
      
      // Fix property naming to match UI expectations
      products = products.map(p => ({ id: p.id, name: p.name }));
      machines = machines.map(m => ({ id: m.id, name: m.name }));
      molds = molds.map(m => ({ id: m.id, name: m.name }));
      tools = tools.map(t => ({ id: t.id, name: t.name }));
      operators = operators.map(o => ({ id: o.id, name: o.name }));
      
      console.log('Loaded dropdown data:', {
        products: products?.length || 0,
        machines: machines?.length || 0,
        molds: molds?.length || 0,
        tools: tools?.length || 0,
        operators: operators?.length || 0
      });
    } catch (err) {
      console.error('Error loading dropdown data:', err);
      // Continue rendering even if dropdown data fails to load
      // to prevent complete page failure
    }
    
    // Current user as owner
    const currentUser = req.session.user || { id: 1, name: 'SYSTEM ADMIN' };
    const owners = [currentUser];
    
    // Render the daily output form
    return res.render('daily_output', {
      title: 'New Daily Output',
      user: currentUser,
      data: dbData,
      options: {
        daily_purpose: OPTION_DAILY_PURPOSE,
        products: products || []
      },
      tools: tools || [],
      machines: machines || [],
      molds: molds || [],
      operators: operators || [],
      owners: owners,
      viewOnly: false,
      txn_mode: txn_mode,
      txn_id: 0,
      lng: {}, // Language placeholders
      session_key: req.session[txn_mode].session_key,
      action_key: helpers.keyHelper(0, txn_mode)
    });
  } catch (err) {
    console.error('Error in dailyOutputNew:', err);
    return res.status(500).send('An error occurred while loading the daily output form');
  }
};

/**
 * Edits an existing daily output record
 */
exports.dailyOutputEdit = async (req, res) => {
  try {
    const dbData = {
      txn_id: req.params.id,
      txn_mode: 'daily_edit',
      heading: 'Edit Daily Output'
    };
    
    await dailyOutputRead(req, res, dbData);
  } catch (error) {
    console.error('Error editing daily output:', error);
    res.status(500).send('Server error');
  }
};

/**
 * Displays an existing daily output record
 */
exports.dailyOutputView = async (req, res) => {
  try {
    const dbData = {
      txn_id: req.params.id,
      txn_mode: 'daily_view',
      heading: 'View Daily Output',
      input_loc: '',
      output_loc: '',
      wc: 'WC'
    };
    
    await dailyOutputRead(req, res, dbData);
  } catch (error) {
    console.error('Error viewing daily output:', error);
    res.status(500).send('Server error');
  }
};

/**
 * Reads data from the database
 */
async function dailyOutputRead(req, res, dbData) {
  try {
    const txn_mode = dbData.txn_mode;
    const txn_id = dbData.txn_id;
    const txn_prev = txn_mode + '_prev';
    
    dbData.input_table_rows = '';
    dbData.output_table_rows = '';
    dbData.tool_table_rows = '';
    
    // Clear session data
    req.session[txn_mode] = {};
    req.session[txn_prev] = {};
    
    // Set session data
    req.session[txn_mode] = {
      txn_id: txn_id,
      txntype_id: 25, // Daily Output
      items_list: {
        input: [],
        output: [],
        tool: []
      },
      loc_batches: [],
      dloc_batches: [],
      item_ids: [],
      session_key: Date.now().toString()
    };
    
    // Get connection from pool
    const connection = await pool.getConnection();
    
    try {
      // Query daily transaction details
      const [rows] = await DailyOutputModel.getDailyTransactionDetails(connection, txn_id);
      
      if (rows.length === 1) {
        const row = rows[0];
        
        // Map column data to dbData
        const colMap = {
          'Purpose_c': 'purpose',
          'SiteId_i': 'site_id',
          'JoId_i': 'jo_id',
          'RowId_i': 'row_id',
          'ProcessId_i': 'process_id',
          'DocRef_v': 'doc_ref',
          'StartTime_tt': 'start_time',
          'EndTime_tt': 'end_time',
          'BreakTime_d': 'break_time',
          'OwnerId_i': 'owner_id',
          'UserAbbrev_v': 'owner_abbrev',
          'LocId_i': 'loc_id',
          'DlocId_i': 'dloc_id',
          'DocRemark_v': 'doc_remark',
          'LocCode_v': 'wc',
          'input_loc': 'input_loc',
          'output_loc': 'output_loc',
          'jo_item_id': 'jo_item_id',
          'jo_reference': 'jo_reference',
          'jo_process': 'jo_process',
          'UpdateKey_i': 'update_key',
          'Status_c': 'status',
          'Void_c': 'void'
        };
        
        // Copy column values to dbData
        for (const [dbCol, jsVar] of Object.entries(colMap)) {
          if (row[dbCol] !== undefined) {
            dbData[jsVar] = row[dbCol];
            req.session[txn_mode][jsVar] = row[dbCol];
          }
        }
        
        // Handle date fields
        const dateMap = {
          'TxnDate_dd': 'txn_date'
        };
        
        for (const [dbCol, jsVar] of Object.entries(dateMap)) {
          if (row[dbCol]) {
            dbData[jsVar] = helpers.sql2date(row[dbCol]);
            req.session[txn_mode][jsVar] = row[dbCol];
          }
        }
        
        // Get machines
        const machines = await DailyOutputModel.getMachines(connection, txn_id);
        dbData.machine_options = machines.map(m => ({
          value: m.machine_id,
          text: m.machine_name,
          selected: m.selected === '1'
        }));
        
        // Get molds
        const molds = await DailyOutputModel.getMolds(connection, txn_id);
        dbData.mold_options = molds.map(m => ({
          value: m.mold_id,
          text: m.mold_name,
          selected: m.selected === '1'
        }));
        
        // Get operators
        const operators = await DailyOutputModel.getOperators(connection, txn_id);
        dbData.operator_options = operators.map(op => ({
          value: op.operator_id,
          text: op.operator_name,
          selected: op.selected === '1'
        }));
        
        // Get items and batches
        const items = await DailyOutputModel.processItemsAndBatches(connection, txn_id);
        dbData.input_items = items.input || [];
        dbData.output_items = items.output || [];
        
        // Get available products
        const products = await DailyOutputModel.getAvailableProducts(connection);
        dbData.product_options = products.map(p => ({
          value: p.product_id,
          text: p.product_name
        }));
      }
    } finally {
      connection.release();
    }
    
    // Render the form
    await dailyOutputRender(req, res, dbData);
  } catch (error) {
    console.error('Error reading daily output:', error);
    res.status(500).send('Server error');
  }
}

/**
 * Renders the daily output form
 */
async function dailyOutputRender(req, res, dbData) {
  try {
    // Prepare data for the template
    const viewData = {
      ...dbData,
      // Add any additional template data here
      user: req.session.user || { name: 'SYSTEM ADMIN' },
      option_daily_purpose: OPTION_DAILY_PURPOSE
    };
    
    // Render the template
    res.render('daily_output', viewData);
  } catch (error) {
    console.error('Error rendering daily output:', error);
    res.status(500).send('Server error');
  }
}

/**
 * Creates a new daily output record from form submission
 */
exports.createDailyOutput = async (req, res) => {
  try {
    const txn_mode = req.body['txn-mode'];
    const session_key = req.body['session-key'];
    
    // Validate session
    if (!req.session[txn_mode] || req.session[txn_mode].session_key !== session_key) {
      return res.status(400).send('Invalid session');
    }
    
    // Process form data
    const formData = {
      purpose: req.body['purpose-option'] || 'S',
      doc_ref: req.body['doc-ref'],
      txn_date: helpers.date2sql(req.body['txn-date']),
      jo_id: req.body['jo-id'] || 0,
      owner_id: req.body['owner-id'] || req.session.user?.id || 1,
      start_time: req.body['start-time'],
      end_time: req.body['end-time'],
      break_time: req.body['break-time'] || 0,
      machine_id: req.body['machine-id'],
      mold_id: req.body['mold-id'],
      doc_remark: req.body['remarks']
    };
    
    // Get connection
    const connection = await pool.getConnection();
    
    try {
      // Begin transaction
      await connection.beginTransaction();
      
      // Insert daily transaction header
      const [result] = await DailyOutputModel.insertDailyTransactionHeader(connection, formData);
      
      const txn_id = result.insertId;
      
      // Insert machine
      if (formData.machine_id) {
        await DailyOutputModel.insertMachine(connection, txn_id, formData.machine_id);
      }
      
      // Insert mold
      if (formData.mold_id) {
        await DailyOutputModel.insertMold(connection, txn_id, formData.mold_id);
      }
      
      // Insert operators
      if (req.body['operator-ids'] && Array.isArray(req.body['operator-ids'])) {
        for (const operatorId of req.body['operator-ids']) {
          await DailyOutputModel.insertOperator(connection, txn_id, operatorId);
        }
      }
      
      // Insert output items
      if (req.body['output-item-ids'] && Array.isArray(req.body['output-item-ids'])) {
        for (let i = 0; i < req.body['output-item-ids'].length; i++) {
          const itemId = req.body['output-item-ids'][i];
          const outputQty = req.body['output-qty'][i] || 0;
          const rejectQty = req.body['reject-qty'][i] || 0;
          const extraQty = req.body['extra-qty'][i] || 0;
          
          await DailyOutputModel.insertOutputItem(connection, txn_id, itemId, outputQty, rejectQty, extraQty);
        }
      }
      
      // Insert input items
      if (req.body['input-item-ids'] && Array.isArray(req.body['input-item-ids'])) {
        for (let i = 0; i < req.body['input-item-ids'].length; i++) {
          const itemId = req.body['input-item-ids'][i];
          const demandQty = req.body['demand-qty'][i] || 0;
          const lotId = req.body['lot-ids'][i] || null;
          
          await DailyOutputModel.insertInputItem(connection, txn_id, itemId, demandQty, lotId);
        }
      }
      
      // Commit transaction
      await connection.commit();
      
      // Redirect to view page
      res.redirect(`/page/manufacture/daily_output/view/${txn_id}`);
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating daily output:', error);
    res.status(500).send('Server error');
  }
};

/**
 * Updates an existing daily output record from form submission
 */
exports.updateDailyOutput = async (req, res) => {
  try {
    const txn_id = req.params.id;
    const txn_mode = req.body['txn-mode'];
    const session_key = req.body['session-key'];
    
    // Validate session
    if (!req.session[txn_mode] || req.session[txn_mode].session_key !== session_key) {
      return res.status(400).send('Invalid session');
    }
    
    // Process form data
    const formData = {
      purpose: req.body['purpose-option'] || 'S',
      txn_date: helpers.date2sql(req.body['txn-date']),
      owner_id: req.body['owner-id'] || req.session.user?.id || 1,
      start_time: req.body['start-time'],
      end_time: req.body['end-time'],
      break_time: req.body['break-time'] || 0,
      machine_id: req.body['machine-id'],
      mold_id: req.body['mold-id'],
      doc_remark: req.body['remarks'],
      update_key: req.session[txn_mode].update_key || 1
    };
    
    // Get connection
    const connection = await pool.getConnection();
    
    try {
      // Begin transaction
      await connection.beginTransaction();
      
      // Update daily transaction header
      await DailyOutputModel.updateDailyTransactionHeader(connection, txn_id, formData);
      
      // Check if update was successful
      const [checkResult] = await DailyOutputModel.checkUpdate(connection, txn_id);
      
      if (checkResult.length === 0 || checkResult[0].UpdateKey_i !== formData.update_key + 1) {
        throw new Error('Record was modified by another user');
      }
      
      // Update machine (delete and insert)
      await DailyOutputModel.deleteMachine(connection, txn_id);
      
      if (formData.machine_id) {
        await DailyOutputModel.insertMachine(connection, txn_id, formData.machine_id);
      }
      
      // Update mold (delete and insert)
      await DailyOutputModel.deleteMold(connection, txn_id);
      
      if (formData.mold_id) {
        await DailyOutputModel.insertMold(connection, txn_id, formData.mold_id);
      }
      
      // Update operators (delete and insert)
      await DailyOutputModel.deleteOperators(connection, txn_id);
      
      if (req.body['operator-ids'] && Array.isArray(req.body['operator-ids'])) {
        for (const operatorId of req.body['operator-ids']) {
          await DailyOutputModel.insertOperator(connection, txn_id, operatorId);
        }
      }
      
      // Update output items (delete and insert)
      await DailyOutputModel.deleteOutputItems(connection, txn_id);
      
      if (req.body['output-item-ids'] && Array.isArray(req.body['output-item-ids'])) {
        for (let i = 0; i < req.body['output-item-ids'].length; i++) {
          const itemId = req.body['output-item-ids'][i];
          const outputQty = req.body['output-qty'][i] || 0;
          const rejectQty = req.body['reject-qty'][i] || 0;
          const extraQty = req.body['extra-qty'][i] || 0;
          
          await DailyOutputModel.insertOutputItem(connection, txn_id, itemId, outputQty, rejectQty, extraQty);
        }
      }
      
      // Update input items (delete and insert)
      await DailyOutputModel.deleteInputItems(connection, txn_id);
      
      if (req.body['input-item-ids'] && Array.isArray(req.body['input-item-ids'])) {
        for (let i = 0; i < req.body['input-item-ids'].length; i++) {
          const itemId = req.body['input-item-ids'][i];
          const demandQty = req.body['demand-qty'][i] || 0;
          const lotId = req.body['lot-ids'][i] || null;
          
          await DailyOutputModel.insertInputItem(connection, txn_id, itemId, demandQty, lotId);
        }
      }
      
      // Commit transaction
      await connection.commit();
      
      // Redirect to view page
      res.redirect(`/page/manufacture/daily_output/view/${txn_id}`);
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating daily output:', error);
    res.status(500).send('Server error');
  }
};

// Helper functions
async function getMachines(connection, txn_id) {
  const [rows] = await DailyOutputModel.getMachines(connection, txn_id);
  
  return rows;
}

async function getMolds(connection, txn_id) {
  const [rows] = await DailyOutputModel.getMolds(connection, txn_id);
  
  return rows;
}

async function getOperators(connection, txn_id) {
  const [rows] = await DailyOutputModel.getOperators(connection, txn_id);
  
  return rows;
}

async function processItemsAndBatches(connection, txn_id) {
  const [rows] = await DailyOutputModel.processItemsAndBatches(connection, txn_id);
  
  return rows;
}

async function getAvailableProducts(connection) {
  const [rows] = await DailyOutputModel.getAvailableProducts(connection);
  
  return rows;
}

async function generateDocReference(dbData) {
  const [rows] = await DailyOutputModel.generateDocReference(dbData);
  
  return rows;
}

// Export both public and private functions
module.exports = {
  dailyOutputNew: exports.dailyOutputNew,
  dailyOutputEdit: exports.dailyOutputEdit,
  dailyOutputView: exports.dailyOutputView,
  createDailyOutput: exports.createDailyOutput,
  updateDailyOutput: exports.updateDailyOutput
};
