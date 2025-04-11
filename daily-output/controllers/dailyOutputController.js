const pool = require('../config/database');
const moment = require('moment');
const helpers = require('../helpers/dateHelpers');
const DailyOutputModel = require('../models/dailyOutputModel');

// Constants
const OPTION_DAILY_PURPOSE = {
  'S': 'STANDARD OUTPUT',
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

/**
 * Handles the daily output inquiry page with search and pagination
 */
exports.dailyOutputInquiry = async (req, res) => {
  try {
    // Process filter parameters - don't set defaults for dates to show all records initially
    const filters = {
      from_date: req.query.from_date || '',
      to_date: req.query.to_date || '',
      reference: req.query.reference || '',
      job_order: req.query.job_order || ''
    };
    
    // Process pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    // Get dashboard counts
    const todayDate = moment().format('YYYY-MM-DD');
    const connection = await pool.getConnection();
    
    try {
      // Count of today's daily outputs
      const [todayOutputResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE TxnDate_dd = ?',
        [todayDate]
      );
      
      // Count of pending approvals - use Status_c which exists in the schema
      const [pendingApprovalsResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE Status_c = ?',
        ['P']
      );
      
      // Count of active work orders - count all records instead
      const [activeWorkOrdersResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_jo_txn'
      );
      
      // Count of completed outputs this month
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
      
      const [completedThisMonthResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE TxnDate_dd BETWEEN ? AND ?',
        [startOfMonth, endOfMonth]
      );
      
      // Get the data with filtering and pagination
      const result = await DailyOutputModel.getDailyOutputList(filters, { page, limit });
      
      // Prepare pagination data
      const pagination = {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalRecords: result.total,
        startRecord: ((result.page - 1) * result.limit) + 1,
        endRecord: Math.min(result.page * result.limit, result.total),
        startPage: Math.max(1, result.page - 2),
        endPage: Math.min(result.totalPages, result.page + 2),
        queryParams: buildQueryString(req.query, ['page'])
      };
      
      // Dashboard counts
      const dashboardCounts = {
        todaysOutput: todayOutputResult[0].count || 0,
        pendingApprovals: pendingApprovalsResult[0].count || 0,
        activeWorkOrders: activeWorkOrdersResult[0].count || 0,
        completedThisMonth: completedThisMonthResult[0].count || 0
      };
      
      // Render the page with data
      res.render('daily_inquiry', {
        title: 'Daily Output Inquiry',
        data: result.data,
        filters: filters,
        pagination: pagination,
        dashboardCounts: dashboardCounts,
        user: req.session.user || { name: 'Guest' }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in dailyOutputInquiry:', error);
    res.status(500).send('An error occurred while loading daily output data');
  }
};

/**
 * Helper function to build query string for pagination links
 */
function buildQueryString(query, excludeParams = []) {
  const params = [];
  
  for (const key in query) {
    if (!excludeParams.includes(key) && query[key]) {
      params.push(`${key}=${encodeURIComponent(query[key])}`);
    }
  }
  
  return params.length > 0 ? `&${params.join('&')}` : '';
}

/**
 * Generates sample data for the daily output inquiry page
 */
exports.generateSampleData = async (req, res) => {
  try {
    // Create a connection to the database
    const connection = await pool.getConnection();
    
    try {
      // Get raw data from the database with minimal columns
      const query = `
        SELECT 
          TxnId_i,
          DocRef_v,
          DATE_FORMAT(TxnDate_dd, '%d-%m-%Y') as TxnDate,
          TIME_FORMAT(StartTime_tt, '%H:%i:%s') as StartTime,
          TIME_FORMAT(EndTime_tt, '%H:%i:%s') as EndTime,
          JoId_i,
          DocRemark_v,
          DATE_FORMAT(CreateDate_dt, '%d-%m-%Y %H:%i:%S') as CreateDate,
          CreateId_i
        FROM tbl_daily_txn
        ORDER BY TxnId_i DESC
        LIMIT 10
      `;
      
      const [rows] = await connection.execute(query);
      console.log('Sample data rows:', rows.length);
      
      // Format the data to match the expected structure
      const data = rows.map(row => ({
        txn_id: row.TxnId_i,
        doc_date: row.TxnDate,
        start_time: row.StartTime,
        end_time: row.EndTime,
        daily_no: row.DocRef_v,
        jo_no: row.JoId_i,
        process_description: 'Process ' + row.JoId_i,
        master_code: 'CTP-000-' + row.JoId_i,
        output_item: 'CTP-PRD-' + row.JoId_i,
        output_qty: Math.floor(Math.random() * 20),
        reject_qty: Math.floor(Math.random() * 5),
        lead_time: row.StartTime + ' - ' + row.EndTime,
        man_count: 1,
        machine: 'Machine ' + (Math.floor(Math.random() * 5) + 1),
        operator: 'Operator ' + (Math.floor(Math.random() * 5) + 1),
        remark: row.DocRemark_v || '',
        create_date: row.CreateDate || moment().format('DD-MM-YYYY HH:mm:SS'),
        issued_by: row.CreateId_i || 'ADMIN'
      }));
      
      // Get counts for dashboard
      const [todayCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE TxnDate_dd = CURDATE()'
      );
      
      const [pendingCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE Status_c = ?',
        ['P']
      );
      
      const [totalCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn'
      );
      
      const [joCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_jo_txn'
      );
      
      const dashboardCounts = {
        todaysOutput: todayCount[0].count || 0,
        pendingApprovals: pendingCount[0].count || 0,
        activeWorkOrders: joCount[0].count || 0,
        completedThisMonth: Math.floor(totalCount[0].count / 2) || 0
      };
      
      // Create pagination data
      const pagination = {
        currentPage: 1,
        totalPages: Math.ceil(totalCount[0].count / 10),
        totalRecords: totalCount[0].count,
        startRecord: 1,
        endRecord: Math.min(10, totalCount[0].count),
        startPage: 1,
        endPage: Math.min(5, Math.ceil(totalCount[0].count / 10)),
        queryParams: ''
      };
      
      // Render the page with the sample data
      res.render('daily_inquiry', {
        title: 'Daily Output Inquiry',
        data: data,
        filters: {
          from_date: '',
          to_date: '',
          reference: '',
          job_order: ''
        },
        pagination: pagination,
        dashboardCounts: dashboardCounts,
        user: req.session.user || { name: 'Guest' }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error generating sample data:', error);
    res.status(500).send('An error occurred while generating sample data');
  }
};

/**
 * Export daily output data to CSV
 */
exports.exportToCsv = async (req, res) => {
  try {
    console.log('Starting CSV export with query params:', req.query);
    
    // Get the same filters that would be used for the inquiry page
    const filters = {
      from_date: req.query.from_date || '',
      to_date: req.query.to_date || '',
      reference: req.query.reference || '',
      job_order: req.query.job_order || ''
    };
    
    // Use the same pagination as the current page view
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    console.log('Filters for CSV export:', filters);
    
    try {
      // Get data with the same pagination as the current page
      console.log('Calling getDailyOutputList for CSV export');
      const result = await DailyOutputModel.getDailyOutputList(filters, { page, limit });
      console.log('Retrieved records for CSV:', result?.data?.length || 0);
      
      if (!result.data || result.data.length === 0) {
        console.log('No data found for CSV export');
        return res.status(404).send('No data to export');
      }
      
      // Create CSV header
      const headers = [
        'TXN ID', 'DOC DATE', 'START TIME', 'END TIME', 'DAILY NO',
        'JO NO', 'PROCESS DESCRIPTION', 'MASTER CODE', 'OUTPUT ITEM',
        'OUTPUT QTY', 'REJECT QTY', 'LEAD TIME', 'MAN COUNT',
        'MACHINE', 'OPERATOR', 'REMARK', 'CREATE DATE', 'ISSUED BY'
      ];
      
      console.log('Creating CSV rows from data');
      // Create CSV rows from data
      const rows = result.data.map(item => [
        item.txn_id,
        item.doc_date,
        item.start_time,
        item.end_time,
        item.daily_no,
        item.jo_no,
        item.process_description || 'N/A',
        item.master_code || 'N/A',
        item.output_item || 'N/A',
        item.output_qty || '0',
        item.reject_qty || '0',
        item.lead_time || 'N/A',
        item.man_count || '1',
        item.machine || 'N/A',
        item.operator || 'N/A',
        item.remark || '',
        item.create_date || 'N/A',
        item.issued_by || 'N/A'
      ]);
      
      // Combine header and rows
      console.log('Generating CSV content');
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      console.log('CSV generation complete, size:', csvContent.length, 'bytes');
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=daily_output_page${page}_${new Date().toISOString().slice(0,10)}.csv`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      
      // Send CSV data
      console.log('Sending CSV response');
      return res.end(csvContent);
    } catch (innerError) {
      console.error('Inner error in exportToCsv:', innerError);
      return res.status(500).send('Error in data processing: ' + innerError.message);
    }
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return res.status(500).send('Error generating CSV: ' + error.message);
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
  updateDailyOutput: exports.updateDailyOutput,
  dailyOutputInquiry: exports.dailyOutputInquiry,
  generateSampleData: exports.generateSampleData,
  exportToCsv: exports.exportToCsv
};