const express = require('express');
const session = require('express-session');
const path = require('path');
const moment = require('moment');
const bodyParser = require('body-parser');
const ejs = require('ejs');

// Import the central database pool
const pool = require('./config/database');

// Load environment variables with explicit path
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debug environment variables
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

const app = express();
const PORT = process.env.PORT || 3000;

// Import route modules for modular approach
const dailyOutputRoutes = require('./m_manufacturing/m_daily_output/routes/dailyOutputRoutes');
const apiRoutes = require('./m_manufacturing/m_daily_output/routes/apiRoutes');

// Middleware
app.use(express.static(path.join(__dirname, 'm_manufacturing/m_daily_output/public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'm_manufacturing/m_daily_output/views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'nexerp-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Helper functions
const helpers = {
  // Format date from SQL to display format (YYYY-MM-DD to DD-MM-YYYY)
  sql2date: (sqlDate) => {
    return moment(sqlDate).format('DD-MM-YYYY');
  },
  
  // Format date from display to SQL format (DD-MM-YYYY to YYYY-MM-DD)
  date2sql: (displayDate) => {
    return moment(displayDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
  },
  
  // Format price with 2 decimal places
  priceFormat: (price) => {
    return parseFloat(price).toFixed(2);
  },
  
  // Multiplication with precision
  bcmul_helper: (a, b, precision = 2) => {
    return (parseFloat(a) * parseFloat(b)).toFixed(precision);
  },
  
  // Addition with precision
  bcadd_helper: (a, b, precision = 2) => {
    return (parseFloat(a) + parseFloat(b)).toFixed(precision);
  },
  
  // Generate unique key for actions
  key_helper: (id, mode) => {
    return `${id}_${mode}_${Date.now()}`;
  }
};

// Global constants
const OPTION_DAILY_PURPOSE = {
  'S': 'STANDARD OUTPUT'
};

// Register modular routes for daily output functionality
app.use('/', dailyOutputRoutes);
app.use('/', apiRoutes);

// Root route - redirect to manufacturing landing page
app.get('/', (req, res) => {
  res.redirect('/page/manufacturing');
});

// Dashboard page
app.get('/page/dashboard', async (req, res) => {
  try {
    // Get dashboard counts - using the same code as in dailyOutputInquiry
    const todayDate = moment().format('YYYY-MM-DD');
    const connection = await pool.getConnection();
    
    try {
      // Count of today's daily outputs
      const [todayOutputResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE TxnDate_dd = ?',
        [todayDate]
      );
      
      // Count of pending approvals
      const [pendingApprovalsResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM tbl_daily_txn WHERE Status_c = ?',
        ['P']
      );
      
      // Count of active work orders
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
      
      // Dashboard counts
      const dashboardCounts = {
        todaysOutput: todayOutputResult[0].count || 0,
        pendingApprovals: pendingApprovalsResult[0].count || 0,
        activeWorkOrders: activeWorkOrdersResult[0].count || 0,
        completedThisMonth: completedThisMonthResult[0].count || 0
      };
      
      res.render('dashboard', {
        title: 'Dashboard',
        dashboardCounts: dashboardCounts,
        user: req.session.user || { name: 'SYSTEM ADMIN' }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    res.status(500).send('An error occurred while loading dashboard data');
  }
});

// Functions for daily output operations
async function dailyOutputNew(req, res, dbData) {
  const txn_mode = 'daily_new';
  
  // Clear session data for this transaction
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
  
  dbData.heading = 'New Daily Output';
  dbData.input_table_rows = '';
  dbData.output_table_rows = '';
  dbData.tool_table_rows = '';
  dbData.session_key = req.session[txn_mode].session_key;
  dbData.txn_mode = txn_mode;
  dbData.txntype_id = 25;
  dbData.txn_id = 0;
  dbData.update_key = 0;
  dbData.action_key = helpers.key_helper(dbData.txn_id, dbData.txn_mode);
  dbData.input_loc = '';
  dbData.output_loc = '';
  dbData.wc = 'WC';
  dbData.void = '0';
  dbData.allow_void = '1';
  
  // Auto date and reference
  dbData.txn_date = moment().format('DD-MM-YYYY');
  dbData.doc_ref = await generateDocReference(dbData);
  req.session[txn_mode].sql_date = sqlDate;
  
  // Render the daily output form
  await dailyOutputRender(req, res, dbData);
}

async function dailyOutputEdit(req, res, dbData) {
  dbData.txn_mode = 'daily_edit';
  dbData.heading = 'Edit Daily Output';
  await dailyOutputRead(req, res, dbData);
}

async function dailyOutputView(req, res, dbData) {
  dbData.txn_mode = 'daily_view';
  dbData.heading = 'View Daily Output';
  dbData.input_loc = '';
  dbData.output_loc = '';
  dbData.wc = 'WC';
  
  await dailyOutputRead(req, res, dbData);
}

async function dailyOutputRead(req, res, dbData) {
  const txn_mode = dbData.txn_mode;
  const txn_id = dbData.txn_id;
  const txn_prev = `${txn_mode}_prev`;
  
  dbData.input_table_rows = '';
  dbData.output_table_rows = '';
  dbData.tool_table_rows = '';
  
  // Reset session data
  req.session[txn_mode] = {};
  req.session[txn_prev] = {};
  
  req.session[txn_mode] = {
    txn_id: txn_id,
    txntype_id: 25, // Daily Output
    items_list: {},
    loc_batches: {},
    dloc_batches: {},
    item_ids: {},
    session_key: Date.now().toString()
  };
  
  // Initialize items list
  req.session[txn_mode].items_list = {
    input: {},
    output: {},
    tool: {}
  };
  
  // Get daily transaction data from database
  const connection = await pool.getConnection();
  
  try {
    // Main transaction data
    const sql = `
      SELECT d.*, u.UserAbbrev_v,
        j.ItemId_i AS jo_item_id, 
        j.DocRef_v AS jo_reference, 
        p.ProcessDescr_v AS jo_process,
        l.LocCode_v, stt.StatusName_v, stt.StatusCss_v,
        CONCAT('(',l.LocCode_v,' - ',l.LocName_v,')') AS input_loc,
        CONCAT('(',dl.LocCode_v,' - ',dl.LocName_v,')') AS output_loc
      FROM tbl_daily_txn d 
      LEFT JOIN tbl_jo_txn j ON j.TxnId_i = d.JoId_i
      LEFT JOIN tbl_jo_process p ON p.RowId_i = d.RowId_i AND p.TxnId_i = d.JoId_i
      LEFT JOIN tbl_comp_loc l ON l.LocId_i = d.LocId_i
      LEFT JOIN tbl_comp_loc dl ON dl.LocId_i = d.DlocId_i
      LEFT JOIN tbl_user u ON u.UserId_i = d.OwnerId_i
      LEFT JOIN tbl_status stt ON stt.Status_c = d.Status_c
      WHERE d.TxnId_i = ?
    `;
    
    const [rows] = await connection.execute(sql, [txn_id]);
    
    if (rows.length === 1) {
      const row = rows[0];
      
      // Map database columns to display fields
      const colArr = {
        'purpose': 'Purpose_c',
        'site_id': 'SiteId_i',
        'jo_id': 'JoId_i',
        'row_id': 'RowId_i',
        'process_id': 'ProcessId_i',
        'doc_ref': 'DocRef_v',
        'start_time': 'StartTime_tt',
        'end_time': 'EndTime_tt',
        'break_time': 'BreakTime_d',
        'owner_id': 'OwnerId_i',
        'owner_abbrev': 'UserAbbrev_v',
        'loc_id': 'LocId_i',
        'dloc_id': 'DlocId_i',
        'doc_remark': 'DocRemark_v',
        'wc': 'LocCode_v',
        'input_loc': 'input_loc',
        'output_loc': 'output_loc',
        'jo_item_id': 'jo_item_id',
        'jo_reference': 'jo_reference',
        'jo_process': 'jo_process',
        'update_key': 'UpdateKey_i',
        'status': 'Status_c',
        'void': 'Void_c'
      };
      
      const dateArr = {
        'txn_date': 'TxnDate_dd'
      };
      
      // Assign values to dbData
      for (const [idx, dbr] of Object.entries(colArr)) {
        dbData[idx] = row[dbr];
        req.session[txn_mode][idx] = row[dbr];
      }
      
      for (const [idx, dbr] of Object.entries(dateArr)) {
        dbData[idx] = helpers.sql2date(row[dbr]);
        req.session[txn_mode][idx] = row[dbr];
      }
      
      req.session[txn_mode].sql_date = row.TxnDate_dd;
    }
    
    // Make a copy for edit mode
    if (txn_mode === 'daily_edit') {
      req.session[txn_prev] = {...req.session[txn_mode]};
    }
    
    dbData.action_key = helpers.key_helper(dbData.txn_id, dbData.txn_mode);
    dbData.table_rows = '';
    dbData.session_key = req.session[txn_mode].session_key;
    
    dbData.trans_id = rows[0]?.TransId_i;
    dbData.allow_void = true;
    
    if (dbData.void) {
      dbData.heading += "&nbsp;&nbsp;<span class='w3-tag w3-round w3-red'>Voided</span>";
    }
    
    // Get machine, mold, tool, and operator data
    const machine_descr = await getMachines(connection, txn_id);
    const mold_descr = await getMolds(connection, txn_id);
    const tool_descr = await getTools(connection, txn_id);
    const operator_descr = await getOperators(connection, txn_id);
    
    dbData.machine_descr = machine_descr;
    dbData.mold_descr = mold_descr;
    dbData.tool_descr = tool_descr;
    dbData.operator_descr = operator_descr;
    
    // Process input and output items and batches
    const {
      input_batches_arr,
      output_batches_arr,
      check_batches_arr,
      input_line_total_arr,
      output_line_total_arr,
      loc_batches,
      dloc_batches
    } = await processItemsAndBatches(connection, txn_id);
    
    // Check if void is allowed
    for (const batch in check_batches_arr) {
      if (dbData.allow_void) {
        const batchIsUsed = await isBatchUsed(connection, batch, txn_id);
        if (batchIsUsed) {
          dbData.allow_void = false;
        }
      }
    }
    
    // Get available items from the location
    const site_id = req.session.user?.site_id || 1;
    const loc_id = dbData.loc_id;
    const work_avail_arr = await getAvailableProductBatches(connection, site_id, loc_id);
    
    // Get input items
    const items_list = req.session[txn_mode].items_list;
    
    const [inputRows] = await connection.execute(
      "SELECT * FROM tbl_daily_item WHERE TxnId_i = ? AND InOut_c='I'",
      [txn_id]
    );
    
    for (const row of inputRows) {
      const row_id = row.RowId_i;
      const stk_id = row.StkId_i;
      const curr_item = await getProductInfoByStockId(connection, stk_id);
      
      const item_id = curr_item.item_id;
      let avail = work_avail_arr[item_id] || 0;
      
      curr_item.grp_id = row.GrpId_i;
      curr_item.shortage = 0;
      curr_item.qty = row.Qty_d;
      curr_item.avail = avail + parseFloat(row.Qty_d);
      
      items_list.input[row_id] = curr_item;
      
      if (input_batches_arr[row_id]) {
        items_list.input[row_id].batches = input_batches_arr[row_id];
      } else {
        items_list.input[row_id].batches = {};
      }
      
      items_list.input[row_id].line_total = input_line_total_arr[row_id];
      
      req.session[txn_mode].item_ids[item_id] = 1;
    }
    
    // Get output items
    const [outputRows] = await connection.execute(
      "SELECT * FROM tbl_daily_item WHERE TxnId_i = ? AND InOut_c='O'",
      [txn_id]
    );
    
    for (const row of outputRows) {
      const row_id = row.RowId_i;
      const stk_id = row.StkId_i;
      const item_id = row.ItemId_i;
      
      const curr_item = await getProductInfoByStockId(connection, stk_id);
      curr_item.qty = row.Qty_d;
      curr_item.reject = row.Reject_d;
      curr_item.extra = row.Extra_d;
      curr_item.grp_id = row.GrpId_i;
      
      items_list.output[row_id] = curr_item;
      
      if (output_batches_arr[row_id]) {
        items_list.output[row_id].batches = output_batches_arr[row_id];
      } else {
        items_list.output[row_id].batches = {};
      }
      
      items_list.output[row_id].line_total = output_line_total_arr[row_id];
      
      req.session[txn_mode].item_ids[item_id] = 1;
    }
    
    // Get tool items
    const [toolRows] = await connection.execute(
      "SELECT * FROM tbl_tool"
    );
    
    const tools = {};
    for (const row of toolRows) {
      tools[row.ToolId_i] = row.ToolDescr_v;
    }
    
    items_list.tools = tools;
    
    const [dailyToolRows] = await connection.execute(
      "SELECT * FROM tbl_daily_tool WHERE TxnId_i = ?",
      [txn_id]
    );
    
    for (const row of dailyToolRows) {
      const curr_item = {};
      const tool_id = row.ToolId_i;
      curr_item.tool_id = tool_id;
      curr_item.prod_descr = tools[tool_id];
      curr_item.qty = row.Counter_d;
      items_list.tool[tool_id] = curr_item;
    }
    
    // Store data in session
    req.session[txn_mode].loc_batches = loc_batches;
    req.session[txn_mode].dloc_batches = dloc_batches;
    req.session[txn_mode].item_ids = req.session[txn_mode].item_ids;
    req.session[txn_mode].check_batches = check_batches_arr;
    
    // Generate table rows for display
    const view_only = txn_mode !== 'daily_edit';
    dbData.input_table_rows = generateDailyTableRow(items_list.input, `${txn_mode}|input|${dbData.purpose}`, '-1', view_only);
    dbData.output_table_rows = generateDailyTableRow(items_list.output, `${txn_mode}|output|${dbData.purpose}`, '-1', view_only);
    
    // Render page
    await dailyOutputRender(req, res, dbData);
  } catch (error) {
    console.error('Error reading daily output:', error);
    res.status(500).send('Server error');
  } finally {
    connection.release();
  }
}

async function dailyOutputRender(req, res, dbData) {
  // Prepare view data
  const viewData = {
    url: req.protocol + '://' + req.get('host'),
    option_daily_purpose: OPTION_DAILY_PURPOSE,
    txn_mode: dbData.txn_mode || 'daily_new',
    heading: dbData.heading || 'Daily Output',
    purpose: dbData.purpose || 'S',
    input_table_rows: dbData.input_table_rows || '',
    output_table_rows: dbData.output_table_rows || '',
    tool_table_rows: dbData.tool_table_rows || '',
    input_loc: dbData.input_loc || '',
    output_loc: dbData.output_loc || '',
    wc: dbData.wc || 'WC',
    session_key: dbData.session_key || '',
    txn_id: dbData.txn_id || 0,
    update_key: dbData.update_key || 0,
    action_key: dbData.action_key || '',
    
    // Form field values
    txn_date: dbData.txn_date || moment().format('DD-MM-YYYY'),
    doc_ref: dbData.doc_ref || '',
    jo_reference: dbData.jo_reference || '',
    jo_process: dbData.jo_process || '',
    owner_id: dbData.owner_id || req.session.user?.id,
    owner_abbrev: dbData.owner_abbrev || req.session.user?.abbrev,
    start_time: dbData.start_time || '',
    end_time: dbData.end_time || '',
    break_time: dbData.break_time || 0,
    doc_remark: dbData.doc_remark || '',
    
    // Selection lists
    machine_descr: dbData.machine_descr || [],
    mold_descr: dbData.mold_descr || [],
    tool_descr: dbData.tool_descr || [],
    operator_descr: dbData.operator_descr || [],
    
    // State flags
    void: dbData.void || '0',
    allow_void: dbData.allow_void || '1',
    
    // Helper functions
    helpers: helpers
  };
  
  // Render the appropriate template based on transaction mode
  res.render('daily_output', viewData);
}

// Helper functions for database operations
async function getMachines(connection, txn_id) {
  const [rows] = await connection.execute(
    "SELECT * FROM tbl_daily_machine WHERE TxnId_i = ?",
    [txn_id]
  );
  
  return rows.map(row => row.MachineId_i);
}

async function getMolds(connection, txn_id) {
  const [rows] = await connection.execute(
    "SELECT * FROM tbl_daily_mold WHERE TxnId_i = ?",
    [txn_id]
  );
  
  return rows.map(row => row.MoldId_i);
}

async function getTools(connection, txn_id) {
  const [rows] = await connection.execute(
    "SELECT * FROM tbl_daily_tool WHERE TxnId_i = ?",
    [txn_id]
  );
  
  return rows.map(row => row.ToolId_i);
}

async function getOperators(connection, txn_id) {
  const [rows] = await connection.execute(
    "SELECT * FROM tbl_daily_operator WHERE TxnId_i = ?",
    [txn_id]
  );
  
  return rows.map(row => row.OperatorId_i);
}

async function processItemsAndBatches(connection, txn_id) {
  const input_line_total_arr = {};
  const output_line_total_arr = {};
  const input_batches_arr = {};
  const output_batches_arr = {};
  const check_batches_arr = {};
  const loc_batches = {};
  const dloc_batches = {};
  
  // Process input batches
  const [inputBatchRows] = await connection.execute(
    `SELECT i.*, b.Cost_d FROM tbl_daily_item_batch i 
     INNER JOIN tbl_product_batch b ON b.ItemId_i = i.ItemId_i AND b.Batch_v = i.Batch_v 
     WHERE i.TxnId_i = ? AND i.InOut_c='I'`,
    [txn_id]
  );
  
  for (const row of inputBatchRows) {
    const row_id = row.RowId_i;
    const batch = row.Batch_v;
    const batch_qty = row.Qty_d;
    const batch_cost = row.Cost_d;
    
    const line_total = helpers.bcmul_helper(batch_qty, batch_cost, 4);
    
    if (!input_batches_arr[row_id]) {
      input_batches_arr[row_id] = {};
    }
    
    input_batches_arr[row_id][batch] = `${batch_qty} x RM ${helpers.priceFormat(batch_cost)}`;
    
    if (input_line_total_arr[row_id]) {
      input_line_total_arr[row_id] = helpers.bcadd_helper(input_line_total_arr[row_id], line_total, 4);
    } else {
      input_line_total_arr[row_id] = line_total;
    }
    
    const item_id = row.ItemId_i;
    if (!loc_batches[item_id]) {
      loc_batches[item_id] = {};
    }
    loc_batches[item_id][batch] = 1;
  }
  
  // Process output batches
  const [outputBatchRows] = await connection.execute(
    `SELECT o.*, b.Cost_d FROM tbl_daily_item_batch o 
     INNER JOIN tbl_product_batch b ON b.ItemId_i = o.ItemId_i AND b.Batch_v = o.Batch_v 
     WHERE o.TxnId_i = ? AND o.Inout_c='O'`,
    [txn_id]
  );
  
  for (const row of outputBatchRows) {
    const row_id = row.RowId_i;
    const batch = row.Batch_v;
    const batch_qty = row.Qty_d;
    const batch_cost = row.Cost_d;
    
    const line_total = helpers.bcmul_helper(batch_qty, batch_cost, 4);
    
    if (!output_batches_arr[row_id]) {
      output_batches_arr[row_id] = {};
    }
    
    output_batches_arr[row_id][batch] = `${batch_qty} x RM ${helpers.priceFormat(batch_cost)}`;
    check_batches_arr[batch] = 1;
    
    if (output_line_total_arr[row_id]) {
      output_line_total_arr[row_id] = helpers.bcadd_helper(output_line_total_arr[row_id], line_total, 4);
    } else {
      output_line_total_arr[row_id] = line_total;
    }
    
    const item_id = row.ItemId_i;
    if (!dloc_batches[item_id]) {
      dloc_batches[item_id] = {};
    }
    dloc_batches[item_id][batch] = 1;
  }
  
  return {
    input_batches_arr,
    output_batches_arr,
    check_batches_arr,
    input_line_total_arr,
    output_line_total_arr,
    loc_batches,
    dloc_batches
  };
}

async function isBatchUsed(connection, batch, txn_id) {
  // Check if batch is used elsewhere
  const [rows] = await connection.execute(
    "SELECT 1 FROM tbl_daily_item_batch WHERE Batch_v = ? AND TxnId_i != ? AND Void_c='0' LIMIT 1",
    [batch, txn_id]
  );
  
  return rows.length > 0;
}

async function getAvailableProductBatches(connection, site_id, loc_id) {
  const [rows] = await connection.execute(
    `SELECT ItemId_i, SUM(Balance_d) as available 
     FROM tbl_product_batch 
     WHERE SiteId_i = ? AND LocId_i = ? AND Balance_d > 0 
     GROUP BY ItemId_i`,
    [site_id, loc_id]
  );
  
  const result = {};
  for (const row of rows) {
    result[row.ItemId_i] = row.available;
  }
  
  return result;
}

async function getProductInfoByStockId(connection, stk_id) {
  const [rows] = await connection.execute(
    `SELECT p.ItemId_i, p.ProdCode_v, p.ProdDescr_v, p.PartNo_v, 
     p.UomId_i, u.UomCode_v, p.Weight_d 
     FROM tbl_product p 
     LEFT JOIN tbl_uom u ON u.UomId_i = p.UomId_i 
     WHERE p.StkId_i = ?`,
    [stk_id]
  );
  
  if (rows.length === 0) {
    return {};
  }
  
  const row = rows[0];
  return {
    item_id: row.ItemId_i,
    prod_code: row.ProdCode_v,
    prod_descr: row.ProdDescr_v,
    part_no: row.PartNo_v,
    uom_id: row.UomId_i,
    uom_code: row.UomCode_v,
    weight: row.Weight_d
  };
}

function generateDailyTableRow(items, mode, highlight, viewOnly) {
  let html = '';
  let count = 1;
  
  // Generate table rows for each item
  for (const [row_id, item] of Object.entries(items)) {
    const itemClass = row_id === highlight ? 'w3-pale-green' : '';
    
    html += `<tr class="${itemClass}">`;
    html += `<td>${count}</td>`;
    
    // Add item description cell
    const description = item.prod_descr || '';
    const part = item.part_no ? `<br><small>${item.part_no}</small>` : '';
    html += `<td>${description}${part}</td>`;
    
    if (mode.includes('|input|')) {
      // Input table format
      html += `<td class="w3-right-align">${item.avail || 0}</td>`;
      html += `<td class="w3-right-align">${item.qty || 0}</td>`;
      
      // Batches cell
      let batchHtml = '';
      if (item.batches) {
        for (const [batch, details] of Object.entries(item.batches)) {
          batchHtml += `${batch}: ${details}<br>`;
        }
      }
      html += `<td>${batchHtml}</td>`;
      
      // Value cell
      html += `<td class="w3-right-align">${item.line_total || 0}</td>`;
    } else if (mode.includes('|output|')) {
      // Output table format
      html += `<td class="w3-right-align">${item.qty || 0}</td>`;
      html += `<td class="w3-right-align">${item.reject || 0}</td>`;
      html += `<td class="w3-right-align">${item.extra || 0}</td>`;
      
      // Calculate stock-in qty
      const stockInQty = parseFloat(item.qty || 0) - parseFloat(item.reject || 0);
      html += `<td class="w3-border-left w3-right-align">${stockInQty}</td>`;
      
      // Batches cell
      let batchHtml = '';
      if (item.batches) {
        for (const [batch, details] of Object.entries(item.batches)) {
          batchHtml += `${batch}: ${details}<br>`;
        }
      }
      html += `<td>${batchHtml}</td>`;
      
      // Value cell
      html += `<td class="w3-right-align">${item.line_total || 0}</td>`;
    } else {
      // Tool table format
      html += `<td class="w3-right-align">${item.qty || 0}</td>`;
      html += `<td></td>`;
    }
    
    html += '</tr>';
    count++;
  }
  
  return html;
}

async function generateDocReference(dbData) {
  // Generate a document reference number
  // Format: DO/YYYYMMDD/####
  const date = moment().format('YYYYMMDD');
  const prefix = 'DO';
  
  const connection = await pool.getConnection();
  try {
    // Get the last document number for today
    const [rows] = await connection.execute(
      `SELECT DocRef_v FROM ${process.env.DB_NAME}.tbl_daily_txn 
       WHERE DocRef_v LIKE ? 
       ORDER BY TxnId_i DESC LIMIT 1`,
      [`${prefix}/${date}/%`]
    );
    
    let seq = 1;
    if (rows.length > 0) {
      // Extract sequence number from last document
      const lastRef = rows[0].DocRef_v;
      const lastSeq = parseInt(lastRef.split('/')[2], 10);
      seq = lastSeq + 1;
    }
    
    // Format sequence as 4 digits
    const seqPadded = seq.toString().padStart(4, '0');
    return `${prefix}/${date}/${seqPadded}`;
  } catch (error) {
    console.error('Error generating document reference:', error);
    // Handle database connection error
    if (error.code === 'ECONNREFUSED') {
      console.error('Database connection refused. Please check your database connection settings.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied to database. Please check your database credentials.');
    } else {
      console.error('An error occurred while generating document reference:', error);
    }
    return `${prefix}/${date}/0001`;
  } finally {
    connection.release();
  }
}

// POST endpoints for create, update, delete
app.post('/page/dailyc', async (req, res) => {
  const txn_mode = req.body['txn-mode'];
  const session_key = req.body['session-key'];
  
  try {
    // Validate session
    if (!req.session[txn_mode] || req.session[txn_mode].session_key !== session_key) {
      return res.status(400).send('Invalid session');
    }
    
    // TODO: Implement create daily output logic
    // This would include:
    // 1. Validating the input data
    // 2. Creating the daily transaction record
    // 3. Creating the item records
    // 4. Creating the batch records
    // 5. Updating inventory
    
    // Redirect to the daily inquiry page
    res.redirect('/page/manufacture/daily_inquiry');
  } catch (error) {
    console.error('Error creating daily output:', error);
    res.status(500).send('Server error');
  }
});

app.post('/page/dailyu', async (req, res) => {
  const txn_mode = req.body['txn-mode'];
  const txn_id = req.body['txn-id'];
  const session_key = req.body['session-key'];
  
  try {
    // Validate session
    if (!req.session[txn_mode] || req.session[txn_mode].session_key !== session_key) {
      return res.status(400).send('Invalid session');
    }
    
    // TODO: Implement update daily output logic
    
    // Redirect to view page
    res.redirect(`/page/manufacture/daily_output/view/${txn_id}`);
  } catch (error) {
    console.error('Error updating daily output:', error);
    res.status(500).send('Server error');
  }
});

app.post('/page/dailydel', async (req, res) => {
  const data = req.body.data;
  const [txn_id, txn_mode, session_key] = data.split('|');
  
  try {
    // Validate session
    if (!req.session[txn_mode] || req.session[txn_mode].session_key !== session_key) {
      return res.status(400).send('Invalid session');
    }
    
    // TODO: Implement void daily output logic
    
    // Redirect to inquiry page
    res.redirect('/page/manufacture/daily_inquiry');
  } catch (error) {
    console.error('Error voiding daily output:', error);
    res.status(500).send('Server error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;