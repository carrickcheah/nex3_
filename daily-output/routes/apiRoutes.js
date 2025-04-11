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
        SELECT ProcessId_i, ProcessDescr_v
        FROM tbl_jo_process
        WHERE TxnId_i = ?
        ORDER BY RowId_i
      `, [rows[0].TxnId_i]);
      
      console.log('Found processes:', processes.length);
      if (processes.length > 0) {
        console.log('First process:', processes[0].ProcessDescr_v);
      } else {
        console.warn('No processes found for JO:', joReference);
      }
      
      // Return JO details
      return res.json({
        success: true,
        jo_id: rows[0].TxnId_i,
        reference: rows[0].DocRef_v,
        product_id: rows[0].ItemId_i,
        product_name: rows[0].product_name,
        process: processes.length > 0 ? processes[0].ProcessDescr_v : null,
        processes: processes.map(p => ({
          id: p.ProcessDescr_v,
          name: p.ProcessDescr_v
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
        SELECT SUM(QtyBalance_d) as outstanding
        FROM tbl_jo_item
        WHERE ProductId_i = ? AND QtyBalance_d > 0
        GROUP BY ProductId_i
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
      // Get current date
      const currentDate = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(currentDate.getMonth() - 3);
      
      // Format dates for MySQL
      const formattedCurrentDate = currentDate.toISOString().split('T')[0];
      const formattedThreeMonthsAgo = threeMonthsAgo.toISOString().split('T')[0];
      
      console.log('Filtering JOs from:', formattedThreeMonthsAgo, 'to:', formattedCurrentDate);
      
      // Improved query with proper filtering:
      // 1. Only active and non-voided JOs
      // 2. Only JOs from the last 3 months
      let query = `
        SELECT 
          j.TxnId_i, 
          j.DocRef_v, 
          j.ItemId_i, 
          j.CreateDate_dt,
          i.StkCode_v as product_code, 
          i.ProdName_v as product_name
        FROM 
          tbl_jo_txn j
        LEFT JOIN 
          tbl_product_code i ON i.ItemId_i = j.ItemId_i
        WHERE 
          j._Status_c = 'P' 
          AND j.Void_c = '0'
          AND j.CreateDate_dt >= ?
      `;
      
      const queryParams = [formattedThreeMonthsAgo];
      
      // Add search condition if provided
      if (searchTerm) {
        query += ` AND (j.DocRef_v LIKE ? OR i.StkCode_v LIKE ? OR i.ProdName_v LIKE ?)`;
        queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      
      // First sort by date DESC (newest first), then by reference
      query += ` ORDER BY 
                  j.CreateDate_dt DESC, 
                  j.DocRef_v ASC`;
      
      // Limit to most recent 200 orders
      query += ` LIMIT 200`;
      
      console.log('Executing job orders query...');
      console.log('Query Params:', queryParams);
      
      // Execute the query
      const [rows] = await connection.query(query, queryParams);
      
      // Log detailed information about the results
      console.log('Job order query returned', rows.length, 'results');
      
      if (rows.length > 0) {
        // Log sample results
        console.log('Sample job orders:', rows.slice(0, 3).map(r => r.DocRef_v));
      } else {
        console.log('WARNING: No job orders found in database!');
      }
      
      const jobOrders = rows.map(row => ({
        id: row.TxnId_i,
        reference: row.DocRef_v,
        createDate: row.CreateDate_dt,
        display: `${row.DocRef_v} - [${row.product_code || ''}] ${row.product_name || ''}`
      }));
      
      // Add specific job orders we want to always include
      const specialJobOrders = [
        'JOTR23050306', 
        'JO23060150', 
        'JO23060216', 
        'JO23060227', 
        'JO23060245', 
        'JO23060246'
      ];
      
      // Check for any special JOs not already in the results
      const existingRefs = jobOrders.map(jo => jo.reference);
      const missingSpecialJOs = specialJobOrders.filter(ref => !existingRefs.includes(ref));
      
      if (missingSpecialJOs.length > 0) {
        console.log('Fetching missing special JOs:', missingSpecialJOs);
        
        // Get the missing special JOs
        const specialQuery = `
          SELECT 
            j.TxnId_i, 
            j.DocRef_v, 
            j.ItemId_i,
            j.CreateDate_dt, 
            i.StkCode_v as product_code, 
            i.ProdName_v as product_name
          FROM 
            tbl_jo_txn j
          LEFT JOIN 
            tbl_product_code i ON i.ItemId_i = j.ItemId_i
          WHERE 
            j.DocRef_v IN (?)
        `;
        
        const [specialRows] = await connection.query(specialQuery, [missingSpecialJOs]);
        
        // Add the special JOs to the result set
        const specialJobOrdersData = specialRows.map(row => ({
          id: row.TxnId_i,
          reference: row.DocRef_v,
          createDate: row.CreateDate_dt,
          display: `${row.DocRef_v} - [${row.product_code || ''}] ${row.product_name || ''}`
        }));
        
        // Combine and sort the results
        jobOrders.push(...specialJobOrdersData);
      }
      
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
      // Get process details
      console.log('Executing process query for JO:', joId, 'Process:', processId);
      const [processRows] = await connection.query(`
        SELECT jp.ProcessId_i, jp.ProcessDescr_v, jp.RowId_i
        FROM tbl_jo_process jp
        WHERE jp.TxnId_i = ? AND jp.ProcessDescr_v = ?
        LIMIT 1
      `, [joId, processId]);
      
      console.log('Process query result:', processRows);
      
      if (processRows.length === 0) {
        console.warn('No process found for JO:', joId, 'Process:', processId);
        return res.status(404).json({ 
          success: false, 
          message: 'Process not found for this job order' 
        });
      }
      
      const rowId = processRows[0].RowId_i;
      console.log('Found RowId:', rowId);

      // Get job order item details (output item)
      console.log('Fetching JO item details for JO:', joId);
      const [joItemRows] = await connection.query(`
        SELECT 
          j.TxnId_i as jo_id,
          j.DocRef_v as jo_reference,
          j.ItemId_i,
          p.StkCode_v as product_code,
          p.ProdName_v as product_name
        FROM tbl_jo_txn j
        LEFT JOIN tbl_product_code p ON p.ItemId_i = j.ItemId_i
        WHERE j.TxnId_i = ?
        LIMIT 1
      `, [joId]);
      
      console.log('JO item query result:', joItemRows);
      
      if (joItemRows.length === 0) {
        console.warn('No job order found with ID:', joId);
        return res.status(404).json({ 
          success: false, 
          message: 'Job order not found' 
        });
      }
      
      // Get input items for this process
      console.log('Fetching input items for JO:', joId, 'RowId:', rowId);
      const [inputRows] = await connection.query(`
        SELECT 
          ji.ItemId_i,
          p.StkCode_v as product_code,
          p.ProdName_v as product_name,
          ji.Qty_d as qty_required,
          ji.TotalQty_d as qty_balance
        FROM tbl_jo_item ji
        LEFT JOIN tbl_product_code p ON p.ItemId_i = ji.ItemId_i
        WHERE ji.TxnId_i = ? AND ji.RowId_i = ?
        ORDER BY ji.Id_i
      `, [joId, rowId]);
      
      console.log('Input items query result count:', inputRows.length);
      
      return res.json({
        success: true,
        jo_details: {
          jo_id: joItemRows[0].jo_id,
          jo_reference: joItemRows[0].jo_reference,
          output_item: {
            id: joItemRows[0].ItemId_i,
            code: joItemRows[0].product_code,
            name: joItemRows[0].product_name
          }
        },
        process: {
          id: processRows[0].ProcessId_i,
          name: processRows[0].ProcessDescr_v,
          row_id: processRows[0].RowId_i
        },
        input_items: inputRows.map(item => ({
          id: item.ItemId_i,
          code: item.product_code,
          name: item.product_name,
          qty_required: item.qty_required,
          qty_balance: item.qty_balance
        }))
      });
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

module.exports = router;