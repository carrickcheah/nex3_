const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const DailyOutputModel = require('../models/dailyOutputModel');

/**
 * API Routes for Daily Output
 */

// Get JO details by reference
router.get('/api/manufacture/jo-details', async (req, res) => {
  try {
    const joReference = req.query.reference;
    
    if (!joReference) {
      return res.status(400).json({ success: false, message: 'Job Order reference is required' });
    }
    
    console.log('Looking for JO reference:', joReference);
    
    const connection = await pool.getConnection();
    
    try {
      // Get basic JO details (only one row needed for this)
      const [rows] = await connection.query(`
        SELECT j.TxnId_i, j.DocRef_v, j.ItemId_i,
               i.StkCode_v as product_code, 
               i.ProdName_v as product_name
        FROM tbl_jo_txn j
        LEFT JOIN tbl_product_code i ON i.ItemId_i = j.ItemId_i
        WHERE j.DocRef_v = ?
        LIMIT 1
      `, [joReference]);
      
      if (rows.length === 0) {
        console.error('JO NOT FOUND in database:', joReference);
        return res.status(404).json({ success: false, message: 'Job Order not found or inactive' });
      }
      
      console.log('Found JO details:', rows[0]);
      
      // Get all processes for this job order - don't limit to 1 process
      const [processes] = await connection.query(`
        SELECT ProcessId_i, ProcessDescr_v, RowId_i, Task_v
        FROM tbl_jo_process
        WHERE TxnId_i = ?
        ORDER BY RowId_i
      `, [rows[0].TxnId_i]);
      
      console.log('Found processes:', processes.length);
      if (processes.length > 0) {
        // Log more details about each process
        processes.forEach((proc, idx) => {
          console.log(`Process ${idx+1}:`, {
            RowId: proc.RowId_i,
            ProcessId: proc.ProcessId_i,
            ProcessDescr: proc.ProcessDescr_v, 
            Task: proc.Task_v
          });
        });
      } else {
        console.warn('No processes found for JO:', joReference);
      }
      
      // Deduplicate processes by ProcessDescr_v
      const uniqueProcessMap = {};
      processes.forEach(proc => {
        if (!uniqueProcessMap[proc.ProcessDescr_v]) {
          uniqueProcessMap[proc.ProcessDescr_v] = proc;
        }
      });
      
      // Convert the map back to an array
      const uniqueProcesses = Object.values(uniqueProcessMap);
      
      console.log('Unique processes after deduplication:', uniqueProcesses.length);
      
      // Return JO details with deduplicated processes
      return res.json({
        success: true,
        jo_id: rows[0].TxnId_i,
        reference: rows[0].DocRef_v,
        product_id: rows[0].ItemId_i,
        product_name: rows[0].product_name,
        process: uniqueProcesses.length > 0 ? uniqueProcesses[0].ProcessDescr_v : null,
        processes: uniqueProcesses.map((p, idx) => ({
          id: p.ProcessDescr_v,
          name: p.ProcessDescr_v,
          row_id: p.RowId_i,
          index: idx + 1
        }))
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching JO details:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get product details by ID
router.get('/api/manufacture/product-details', async (req, res) => {
  try {
    const productId = req.query.product_id;
    
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // Get product details
      const [rows] = await connection.query(`
        SELECT p.ItemId_i, 
               p.StkCode_v as code, 
               p.ProdName_v as name,
               p.UomId_i as uom,
               p.RefCost_d as cost
        FROM tbl_product_code p
        WHERE p.ItemId_i = ? AND p.Deleted_c = '0'
        LIMIT 1
      `, [productId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Product not found or inactive' });
      }
      
      // Get outstanding balances from other transactions
      const [outstandingRows] = await connection.query(`
        SELECT SUM(TotalQty_d) as outstanding
        FROM tbl_jo_item
        WHERE ItemId_i = ? AND TotalQty_d > 0
        GROUP BY ItemId_i
      `, [productId]);
      
      const outstanding = outstandingRows.length > 0 ? outstandingRows[0].outstanding : 0;
      
      // Return product details
      return res.json({
        success: true,
        product_id: rows[0].ItemId_i,
        product_code: rows[0].code,
        product_name: rows[0].name,
        unit_price: rows[0].cost,
        unit_cost: rows[0].cost,
        qty_on_hand: rows[0].uom,
        outstanding: outstanding
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching product details:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Void a daily output record
router.post('/api/manufacture/daily-output/void/:id', async (req, res) => {
  try {
    const txnId = req.params.id;
    
    // Check if user is authorized
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Update the transaction status to void
      const [result] = await connection.execute(`
        UPDATE tbl_daily_txn
        SET Status_c = 'V', Void_c = '1', UpdateKey_i = UpdateKey_i + 1
        WHERE TxnId_i = ? AND Status_c = 'A'
      `, [txnId]);
      
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Record not found or already voided' });
      }
      
      // Log the void action
      await connection.execute(`
        INSERT INTO tbl_log (TxnId_i, UserId_i, LogType_c, LogDate_dt, LogDescr_v)
        VALUES (?, ?, 'V', NOW(), 'Void daily output')
      `, [txnId, req.session.user.id]);
      
      await connection.commit();
      
      return res.json({ success: true, message: 'Record voided successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error voiding daily output:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get available batches for a product
router.get('/api/manufacture/product-batches', async (req, res) => {
  try {
    const productId = req.query.product_id;
    
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // Get available batches
      const [rows] = await connection.query(`
        SELECT sb.StockId_i, sb.BatchCode_v, sb.QtyBalance_d, sb.ExpDate_dd
        FROM tbl_stock_batch sb
        WHERE sb.ProductId_i = ? AND sb.QtyBalance_d > 0 AND sb.Status_c = 'A'
        ORDER BY sb.CreateDate_dt
      `, [productId]);
      
      return res.json({
        success: true,
        batches: rows.map(b => ({
          id: b.StockId_i,
          batch_code: b.BatchCode_v,
          qty_balance: b.QtyBalance_d,
          exp_date: b.ExpDate_dd
        }))
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching product batches:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get available job orders for dropdown
router.get('/api/manufacture/job-orders', async (req, res) => {
  try {
    const searchTerm = req.query.search || '';
    
    console.log('Request for job orders received:', { searchTerm });
    
    const connection = await pool.getConnection();
    
    try {
      // Set start date to January 1, 2023
      const startOf2023 = new Date('2023-01-01');
      const formatted2023Start = startOf2023.toISOString().split('T')[0];
      
      console.log('Filtering JOs since:', formatted2023Start);
      
      // Improved query to get only the latest record for each DocRef_v
      // Ensuring we get the exact same DocRef_v only once
      let query = `
        WITH latest_jos AS (
          SELECT 
            j.TxnId_i,
            j.DocRef_v,
            j.ItemId_i,
            j.CreateDate_dt,
            ROW_NUMBER() OVER (PARTITION BY j.DocRef_v ORDER BY j.CreateDate_dt DESC) as row_num
          FROM 
            tbl_jo_txn j
          WHERE 
            (j._Status_c = 'P' OR j._Status_c = 'C')
            AND j.Void_c = '0'
            AND j.CreateDate_dt >= ?
        )
        SELECT 
          lj.TxnId_i, 
          lj.DocRef_v, 
          lj.ItemId_i, 
          lj.CreateDate_dt,
          i.StkCode_v as product_code, 
          i.ProdName_v as product_name
        FROM 
          latest_jos lj
        LEFT JOIN 
          tbl_product_code i ON i.ItemId_i = lj.ItemId_i
        WHERE 
          lj.row_num = 1
      `;
      
      const queryParams = [formatted2023Start];
      
      // Add search condition if provided
      if (searchTerm) {
        query += ` AND (lj.DocRef_v LIKE ? OR i.StkCode_v LIKE ? OR i.ProdName_v LIKE ?)`;
        queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      
      // Sort and limit - newest first
      query += ` ORDER BY lj.CreateDate_dt DESC, lj.DocRef_v ASC LIMIT 1000`;
      
      console.log('Executing improved job orders query...');
      
      // Execute the query
      const [rows] = await connection.query(query, queryParams);
      
      console.log('Job orders query returned', rows.length, 'results');
      
      // Double-check for duplicates on server side
      const uniqueRefs = new Set();
      const uniqueRows = rows.filter(row => {
        if (uniqueRefs.has(row.DocRef_v)) {
          return false;
        }
        uniqueRefs.add(row.DocRef_v);
        return true;
      });
      
      if (uniqueRows.length !== rows.length) {
        console.log(`Removed ${rows.length - uniqueRows.length} duplicate job orders on server side`);
      }
      
      if (uniqueRows.length > 0) {
        // Log sample results
        console.log('Sample job orders:', uniqueRows.slice(0, 3).map(r => r.DocRef_v));
      } else {
        console.log('WARNING: No job orders found in database!');
      }
      
      const jobOrders = uniqueRows.map(row => ({
        id: row.TxnId_i,
        reference: row.DocRef_v,
        createDate: row.CreateDate_dt,
        display: `${row.DocRef_v} - [${row.product_code || ''}] ${row.product_name || ''}`
      }));
      
      console.log('Returning', jobOrders.length, 'formatted job orders to client');
      
      return res.json({
        success: true,
        job_orders: jobOrders
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching job orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch job orders',
      error: error.message
    });
  }
});

// Get JO process details including input and output items
router.get('/api/manufacture/jo-process-details', async (req, res) => {
  try {
    const joId = req.query.jo_id;
    const processId = req.query.process_id;
    
    console.log('Fetching process details:', { joId, processId });
    
    if (!joId || !processId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Job Order ID and Process ID are required' 
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // First, check what processes exist for this job order to help debugging
      console.log('Checking all available processes for JO:', joId);
      const [allProcesses] = await connection.query(`
        SELECT ProcessDescr_v, RowId_i, Task_v, Machine_v, Mold_v
        FROM tbl_jo_process
        WHERE TxnId_i = ?
        ORDER BY RowId_i
      `, [joId]);
      
      console.log('Available processes found:', allProcesses.length);
      allProcesses.forEach((proc, idx) => {
        console.log(`Available Process ${idx+1}:`, {
          RowId: proc.RowId_i,
          ProcessDescr: proc.ProcessDescr_v, 
          Task: proc.Task_v,
          Machine_v: proc.Machine_v,
          Mold_v: proc.Mold_v
        });
      });
      
      // Get the specific process with more flexible matching
      // Clean up processId to handle various formats:
      // - "1. ProcessName" (new format with index)
      // - "ProcessName" (original format)
      let cleanProcessId = processId;
      
      // Handle new format with index number
      const indexMatch = processId.match(/^\d+\.\s+(.+)$/);
      if (indexMatch) {
        cleanProcessId = indexMatch[1];
        console.log('Extracted process name from indexed format:', cleanProcessId);
      } 
      // Handle original format with process number (legacy support)
      else if (processId.includes('. ')) {
        cleanProcessId = processId.split('. ')[1];
        console.log('Extracted process name from legacy format:', cleanProcessId);
      }
      
      console.log('Using clean process ID for matching:', cleanProcessId);
      
      // Try multiple matching approaches in order of specificity
      let processRows = [];
      
      // 1. First try exact match
      console.log('Trying exact process match for:', cleanProcessId);
      const [exactMatches] = await connection.query(`
        SELECT jp.ProcessDescr_v, jp.RowId_i, jp.Machine_v, jp.Mold_v
        FROM tbl_jo_process jp
        WHERE jp.TxnId_i = ? AND jp.ProcessDescr_v = ?
        LIMIT 1
      `, [joId, cleanProcessId]);
      
      if (exactMatches.length > 0) {
        console.log('Found exact process match:', exactMatches[0]);
        processRows = exactMatches;
      } else {
        // 2. Try match with LIKE
        console.log('Trying LIKE match for:', cleanProcessId);
        const [likeMatches] = await connection.query(`
          SELECT jp.ProcessDescr_v, jp.RowId_i, jp.Machine_v, jp.Mold_v
          FROM tbl_jo_process jp
          WHERE jp.TxnId_i = ? AND jp.ProcessDescr_v LIKE ?
          LIMIT 1
        `, [joId, `%${cleanProcessId}%`]);
        
        if (likeMatches.length > 0) {
          console.log('Found LIKE process match:', likeMatches[0]);
          processRows = likeMatches;
        } else if (allProcesses.length > 0) {
          // 3. Fallback: just use the first process if no matches
          console.log('No match found, using first available process as fallback:', allProcesses[0]);
          processRows = [allProcesses[0]];
        }
      }
      
      if (processRows.length === 0) {
        console.warn('No process found for JO:', joId, 'Process:', processId);
        return res.status(404).json({ 
          success: false, 
          message: 'Process not found for this job order' 
        });
      }
      
      const rowId = processRows[0].RowId_i;
      console.log('Using RowId for queries:', rowId);

      // Get job order item details (output item)
      console.log('Fetching JO item details for JO:', joId);
      const [joItemRows] = await connection.query(`
        SELECT 
          j.TxnId_i as jo_id,
          j.DocRef_v as jo_reference,
          j.ItemId_i,
          p.StkCode_v as product_code,
          p.ProdName_v as product_name,
          ji.TotalQty_d as planned_qty,
          COALESCE(ji.OutstandQty_d, ji.TotalQty_d - COALESCE(ji.CompQty_d, 0), 0) as balance_qty
        FROM tbl_jo_txn j
        LEFT JOIN tbl_product_code p ON p.ItemId_i = j.ItemId_i
        LEFT JOIN tbl_jo_item ji ON ji.TxnId_i = j.TxnId_i AND ji.ItemId_i = j.ItemId_i
        WHERE j.TxnId_i = ?
        LIMIT 1
      `, [joId]);
      
      console.log('JO item query result:', joItemRows.length > 0 ? 'found' : 'not found');
      
      if (joItemRows.length === 0) {
        console.warn('No job order found with ID:', joId);
        return res.status(404).json({ 
          success: false, 
          message: 'Job order not found' 
        });
      }
      
      // ADDED: Debug the JO output item details
      console.log('JO output item details:', joItemRows[0]);
      
      // Get machines for this process using Machine_v from tbl_jo_process
      console.log('Getting machines using Machine_v from process record');
      let machines = [];
      
      if (processRows[0].Machine_v) {
        // Machine_v might contain comma-separated list of machine IDs or names
        let machineValues = processRows[0].Machine_v.split(',').map(m => m.trim());
        console.log('Machine values from process record:', machineValues);
        
        if (machineValues.length > 0) {
          // Try to match by ID first
          if (!isNaN(machineValues[0])) {
            // If it's numeric, assume these are machine IDs
            const placeholders = machineValues.map(() => '?').join(',');
            const [machinesByIds] = await connection.query(`
              SELECT 
                m.MachineId_i as id,
                m.MachineName_v as name
              FROM 
                tbl_machine m
              WHERE 
                m.Status_i = 1
                AND m.MachineId_i IN (${placeholders})
              ORDER BY 
                m.MachineName_v
            `, machineValues);
            
            machines = machinesByIds;
            console.log('Found machines by IDs:', machines.length);
          } else {
            // If not numeric, assume these are machine names or partial names
            // Use OR conditions for each value
            const conditions = machineValues.map(() => 'm.MachineName_v LIKE ?').join(' OR ');
            const params = machineValues.map(v => `%${v}%`);
            
            const [machinesByNames] = await connection.query(`
              SELECT 
                m.MachineId_i as id,
                m.MachineName_v as name
              FROM 
                tbl_machine m
              WHERE 
                m.Status_i = 1
                AND (${conditions})
              ORDER BY 
                m.MachineName_v
            `, params);
            
            machines = machinesByNames;
            console.log('Found machines by names:', machines.length);
          }
        }
      }
      
      // If no specific machines found, get a default set
      if (machines.length === 0) {
        console.log('No specific machines found, using defaults');
        const [defaultMachines] = await connection.query(`
          SELECT 
            m.MachineId_i as id,
            m.MachineName_v as name
          FROM 
            tbl_machine m
          WHERE 
            m.Status_i = 1
          ORDER BY 
            m.MachineName_v
          LIMIT 10
        `);
        
        machines = defaultMachines;
      }
      
      console.log('Final machine count:', machines.length);
      
      // Get molds for this process using Mold_v from tbl_jo_process
      console.log('Getting molds using Mold_v from process record');
      let molds = [];
      
      if (processRows[0].Mold_v) {
        // Mold_v might contain comma-separated list of mold IDs or names
        let moldValues = processRows[0].Mold_v.split(',').map(m => m.trim());
        console.log('Mold values from process record:', moldValues);
        
        if (moldValues.length > 0) {
          // Try to match by ID first
          if (!isNaN(moldValues[0])) {
            // If it's numeric, assume these are mold IDs
            const placeholders = moldValues.map(() => '?').join(',');
            const [moldsByIds] = await connection.query(`
              SELECT 
                m.MoldId_i as id,
                m.MoldDescr_v as name
              FROM 
                tbl_mold m
              WHERE 
                m.Status_i = 1
                AND m.MoldId_i IN (${placeholders})
              ORDER BY 
                m.MoldDescr_v
            `, moldValues);
            
            molds = moldsByIds;
            console.log('Found molds by IDs:', molds.length);
          } else {
            // If not numeric, assume these are mold names or partial names
            // Use OR conditions for each value
            const conditions = moldValues.map(() => 'm.MoldDescr_v LIKE ?').join(' OR ');
            const params = moldValues.map(v => `%${v}%`);
            
            const [moldsByNames] = await connection.query(`
              SELECT 
                m.MoldId_i as id,
                m.MoldDescr_v as name
              FROM 
                tbl_mold m
              WHERE 
                m.Status_i = 1
                AND (${conditions})
              ORDER BY 
                m.MoldDescr_v
            `, params);
            
            molds = moldsByNames;
            console.log('Found molds by names:', molds.length);
          }
        }
      }
      
      // If no specific molds found, get a default set
      if (molds.length === 0) {
        console.log('No specific molds found, using defaults');
        const [defaultMolds] = await connection.query(`
          SELECT 
            m.MoldId_i as id,
            m.MoldDescr_v as name
          FROM 
            tbl_mold m
          WHERE 
            m.Status_i = 1
          ORDER BY 
            m.MoldDescr_v
          LIMIT 10
        `);
        
        molds = defaultMolds;
      }
      
      console.log('Final mold count:', molds.length);
      
      // Get input items for this process
      console.log('Fetching input items for JO:', joId, 'RowId:', rowId);
      const [inputRows] = await connection.query(`
        SELECT 
          ji.ItemId_i,
          p.StkCode_v as product_code,
          p.ProdName_v as product_name,
          COALESCE(di.Qty_d, ji.Qty_d) as qty_required,
          COALESCE(pq.AvailQty_d, 0) as qty_balance
        FROM tbl_jo_item ji
        LEFT JOIN tbl_product_code p ON p.ItemId_i = ji.ItemId_i
        LEFT JOIN tbl_product_qty pq ON pq.ItemId_i = ji.ItemId_i
        LEFT JOIN tbl_daily_item di ON di.ItemId_i = ji.ItemId_i AND di.InOut_c = 'I' 
          AND di.TxnId_i = (
            SELECT dt.TxnId_i FROM tbl_daily_txn dt 
            WHERE dt.JoId_i = ? AND dt.RowId_i = ? 
            ORDER BY dt.CreateDate_dt DESC LIMIT 1
          )
        WHERE ji.TxnId_i = ? AND ji.RowId_i = ?
          AND COALESCE(pq.AvailQty_d, 0) > 0
        GROUP BY ji.ItemId_i  /* Group by ItemId_i to eliminate duplicates */
        ORDER BY p.ProdName_v  /* Order by product name for better display */
      `, [joId, rowId, joId, rowId]);
      
      console.log('Input items query result count:', inputRows.length);
      
      // ADDED: Debug the input items more extensively
      if (inputRows.length > 0) {
        console.log('Sample input item:', inputRows[0]);
        
        // Check if we can find non-zero PrQty_d values
        const [nonZeroQty] = await connection.query(`
          SELECT ItemId_i, PrQty_d FROM tbl_product_qty 
          WHERE PrQty_d > 0 
          ORDER BY PrQty_d 
          LIMIT 5
        `);
        
        console.log('Products with non-zero quantities:', nonZeroQty);
      }
      
      // If no input items found using exact RowId, try a more flexible approach
      let inputItems = inputRows;
      if (inputRows.length === 0) {
        console.log('No input items found with exact RowId, trying fallback...');
        
        // Try to get any input items for this JO
        const [fallbackInputRows] = await connection.query(`
          SELECT 
            ji.ItemId_i,
            p.StkCode_v as product_code,
            p.ProdName_v as product_name,
            COALESCE(di.Qty_d, ji.Qty_d) as qty_required,
            COALESCE(pq.AvailQty_d, 0) as qty_balance,
            ji.RowId_i
          FROM tbl_jo_item ji
          LEFT JOIN tbl_product_code p ON p.ItemId_i = ji.ItemId_i
          LEFT JOIN tbl_product_qty pq ON pq.ItemId_i = ji.ItemId_i
          LEFT JOIN tbl_daily_item di ON di.ItemId_i = ji.ItemId_i AND di.InOut_c = 'I'
            AND di.TxnId_i = (
              SELECT dt.TxnId_i FROM tbl_daily_txn dt 
              WHERE dt.JoId_i = ? 
              ORDER BY dt.CreateDate_dt DESC LIMIT 1
            )
          WHERE ji.TxnId_i = ?
            AND COALESCE(pq.AvailQty_d, 0) > 0
          ORDER BY ji.RowId_i, ji.Id_i
          LIMIT 10
        `, [joId, joId]);
        
        if (fallbackInputRows.length > 0) {
          console.log('Found fallback input items:', fallbackInputRows.length);
          inputItems = fallbackInputRows;
        }
      }
      
      // Deduplicate input items by ItemId_i - only keep latest entry for each unique product
      // Also filter to ensure only items with qty_balance > 0 are included
      console.log('Deduplicating input items and filtering for available qty > 0');
      const uniqueItemsMap = {};
      
      // First pass: collect items by ItemId_i, keeping only latest entry (assuming ordered by Id_i)
      inputItems.forEach(item => {
        if (parseFloat(item.qty_balance) > 0) {
          uniqueItemsMap[item.ItemId_i] = item;
        }
      });
      
      // Convert back to array
      const deduplicatedItems = Object.values(uniqueItemsMap);
      console.log(`Deduplicated from ${inputItems.length} to ${deduplicatedItems.length} input items`);
      
      // Prepare response
      const response = {
        success: true,
        jo_details: {
          jo_id: joItemRows[0].jo_id,
          jo_reference: joItemRows[0].jo_reference,
          output_item: {
            id: joItemRows[0].ItemId_i,
            code: joItemRows[0].product_code,
            name: joItemRows[0].product_name,
            quantity: joItemRows[0].planned_qty || 0,
            outstanding: joItemRows[0].balance_qty || 0
          }
        },
        process: {
          id: processRows[0].RowId_i,
          name: processRows[0].ProcessDescr_v,
          row_id: processRows[0].RowId_i
        },
        machines: machines.map(machine => ({
          id: machine.id,
          name: machine.name
        })),
        molds: molds.map(mold => ({
          id: mold.id,
          name: mold.name
        })),
        input_items: deduplicatedItems.map(item => {
          // ADDED: Enhanced logging for input item
          console.log('Processing input item:', {
            id: item.ItemId_i,
            code: item.product_code,
            required: item.qty_required,
            balance: item.qty_balance
          });
          
          // Remove hard-coded value and use actual data
          // If the specific product doesn't have a quantity, let's retain the database value
          // This ensures we're being flexible with whatever data is in the database
          return {
            id: item.ItemId_i,
            code: item.product_code,
            name: item.product_name,
            qty_required: parseFloat(item.qty_required) || 0,
            qty_balance: parseFloat(item.qty_balance) || 0,
            lot: joItemRows[0].jo_reference
          };
        })
      };
      
      console.log('Returning response with:', {
        machineCount: response.machines.length,
        moldCount: response.molds.length,
        inputItemCount: response.input_items.length
      });
      
      return res.json(response);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching JO process details:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get machines for dropdown
router.get('/api/manufacture/machines', async (req, res) => {
  try {
    console.log('Request for machines received');
    
    const connection = await pool.getConnection();
    
    try {
      // Get all active machines from the database
      const [rows] = await connection.query(`
        SELECT 
          m.MachineId_i as id, 
          m.MachineName_v as name
        FROM 
          tbl_machine m
        WHERE 
          m.Status_i = 1
        ORDER BY 
          m.MachineName_v
      `);
      
      console.log('Machines query returned', rows.length, 'results');
      
      return res.json({
        success: true,
        machines: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching machines:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch machines',
      error: error.message
    });
  }
});

// Get molds for dropdown
router.get('/api/manufacture/molds', async (req, res) => {
  try {
    console.log('Request for molds received');
    
    const connection = await pool.getConnection();
    
    try {
      // Check the actual table structure first
      const [columns] = await connection.query('SHOW COLUMNS FROM tbl_mold');
      console.log('tbl_mold columns:', columns.map(c => c.Field));
      
      // Use the correct column names that exist in the database
      const [rows] = await connection.query(`
        SELECT 
          m.MoldId_i as id, 
          m.MoldDescr_v as name
        FROM 
          tbl_mold m
        WHERE 
          m.Status_i = 1
        ORDER BY 
          m.MoldDescr_v
      `);
      
      console.log('Molds query returned', rows.length, 'results');
      
      return res.json({
        success: true,
        molds: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching molds:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch molds',
      error: error.message
    });
  }
});

// Get tools for dropdown
router.get('/api/manufacture/tools', async (req, res) => {
  try {
    console.log('Request for tools received');
    
    const connection = await pool.getConnection();
    
    try {
      // Check the actual table structure first
      const [columns] = await connection.query('SHOW COLUMNS FROM tbl_tool');
      console.log('tbl_tool columns:', columns.map(c => c.Field));
      
      // Use the correct column names that exist in the database
      const [rows] = await connection.query(`
        SELECT 
          t.ToolId_i as id, 
          t.ToolDescr_v as name
        FROM 
          tbl_tool t
        WHERE 
          t.Status_i = 1
        ORDER BY 
          t.ToolDescr_v
      `);
      
      console.log('Tools query returned', rows.length, 'results');
      
      return res.json({
        success: true,
        tools: rows
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching tools:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tools',
      error: error.message
    });
  }
});

// Get operators for dropdown
router.get('/api/manufacture/operators', async (req, res) => {
  try {
    console.log('Request for operators received');
    
    const connection = await pool.getConnection();
    
    try {
      // Get all operators with UserAbbrev_v as the ID code
      const [rows] = await connection.query(`
        SELECT 
          u.UserId_i as id, 
          u.UserName_v as name,
          u.UserAbbrev_v as abbrev
        FROM 
          tbl_user u
        WHERE 
          u.Status_i = 1 AND
          u.RoleCode_c IN ('58250F20', '925F50F0', '20E0566F', '09920F66', '90025F5E', '2500FC5F','E25F6C00',
                          '8F060273','86600F12','706102F0','6420F05F','62601F05','F700E026','7A20450F', '6320A0F6',
                          '602C068F', 'CF2600C5','2260F026','35250A0F')
        ORDER BY 
          u.UserAbbrev_v
      `);
      
      console.log('Operators query returned', rows.length, 'results');
      
      // Log a sample operator to check data format
      if (rows.length > 0) {
        console.log('Sample operator data:', rows[0]);
      }
      
      // Return operators with a simple format - no fancy processing needed
      // The frontend will just display what we send directly
      return res.json({
        success: true,
        operators: rows.map(op => ({
          id: op.id,
          // No formatting - just return raw data
          name: op.name,
          abbrev: op.abbrev
        }))
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching operators:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch operators',
      error: error.message
    });
  }
});

module.exports = router;