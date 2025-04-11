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
    
    const connection = await pool.getConnection();
    
    try {
      // Get JO details
      const [rows] = await connection.query(`
        SELECT j.TxnId_i, j.DocRef_v, j.ItemId_i, p.ProcessDescr_v,
               i.StkCode_v as product_code, 
               i.ProdName_v as product_name
        FROM tbl_jo_txn j
        LEFT JOIN tbl_jo_process p ON p.TxnId_i = j.TxnId_i
        LEFT JOIN tbl_product_code i ON i.ItemId_i = j.ItemId_i
        WHERE j.DocRef_v = ? AND j._Status_c = 'P' AND j.Void_c = '0'
        LIMIT 1
      `, [joReference]);
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Job Order not found or inactive' });
      }
      
      // Get process options
      const [processes] = await connection.query(`
        SELECT ProcessId_i, ProcessDescr_v
        FROM tbl_jo_process
        WHERE TxnId_i = ?
        ORDER BY RowId_i
      `, [rows[0].TxnId_i]);
      
      // Return JO details
      return res.json({
        success: true,
        jo_id: rows[0].TxnId_i,
        reference: rows[0].DocRef_v,
        product_id: rows[0].ItemId_i,
        product_name: rows[0].product_name,
        process: rows[0].ProcessDescr_v || null,
        processes: processes.map(p => ({
          id: p.ProcessId_i,
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
    let prefixes = req.query.prefixes;
    const includeAll = req.query.includeAll === 'true' || req.query.includeAll === true;
    
    console.log('Request params:', {
      searchTerm, 
      prefixes, 
      includeAll,
      originalIncludeAll: req.query.includeAll
    });
    
    // Handle prefixes parameter (could be string or array)
    if (!includeAll && prefixes && !Array.isArray(prefixes)) {
      try {
        prefixes = JSON.parse(prefixes);
      } catch (e) {
        prefixes = [prefixes];
      }
    }
    
    const connection = await pool.getConnection();
    
    try {
      // Check for patterns in database
      const [prefixCounts] = await connection.query(`
        SELECT LEFT(DocRef_v, 4) AS prefix, COUNT(*) as count 
        FROM tbl_jo_txn 
        WHERE _Status_c = 'P' AND Void_c = '0' 
        GROUP BY prefix
        ORDER BY count DESC
        LIMIT 10
      `);
      
      console.log('Available prefixes in DB:', prefixCounts);
      
      // If we have search term, use normal query
      if (searchTerm) {
        let query = `
          SELECT 
            j.TxnId_i, 
            j.DocRef_v, 
            j.ItemId_i, 
            i.StkCode_v as product_code, 
            i.ProdName_v as product_name
          FROM 
            tbl_jo_txn j
          LEFT JOIN 
            tbl_product_code i ON i.ItemId_i = j.ItemId_i
          WHERE 
            j._Status_c = 'P' 
            AND j.Void_c = '0'
            AND (j.DocRef_v LIKE ? OR i.StkCode_v LIKE ? OR i.ProdName_v LIKE ?)
          ORDER BY j.DocRef_v ASC
          LIMIT 500
        `;
        
        const [rows] = await connection.query(query, 
          [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );
        
        const jobOrders = rows.map(row => ({
          id: row.TxnId_i,
          reference: row.DocRef_v,
          display: `${row.DocRef_v} - [${row.product_code || ''}] ${row.product_name || ''} #${row.TxnId_i}`
        }));
        
        return res.json({
          success: true,
          job_orders: jobOrders
        });
      }
      
      // For initial load (no search term), use UNION to get a mix of different prefixes
      let unionQuery = '';
      const queryParams = [];
      
      // Get top 5 prefixes from DB
      const topPrefixes = prefixCounts.slice(0, 5).map(p => p.prefix);
      
      topPrefixes.forEach((prefix, index) => {
        unionQuery += `
          (SELECT 
            j.TxnId_i, 
            j.DocRef_v, 
            j.ItemId_i, 
            i.StkCode_v as product_code, 
            i.ProdName_v as product_name
          FROM 
            tbl_jo_txn j
          LEFT JOIN 
            tbl_product_code i ON i.ItemId_i = j.ItemId_i
          WHERE 
            j._Status_c = 'P' 
            AND j.Void_c = '0'
            AND j.DocRef_v LIKE ?
          ORDER BY j.DocRef_v ASC
          LIMIT 100)
        `;
        
        queryParams.push(`${prefix}%`);
        
        if (index < topPrefixes.length - 1) {
          unionQuery += ' UNION ALL ';
        }
      });
      
      // Add final ORDER BY to the entire result set
      unionQuery += ' ORDER BY DocRef_v ASC';
      
      console.log('Using UNION query for diverse results');
      console.log('Query Params:', queryParams);
      
      // Execute the UNION query
      const [rows] = await connection.query(unionQuery, queryParams);
      
      console.log('Result count:', rows.length);
      if (rows.length > 0) {
        console.log('First 5 results:', rows.slice(0, 5).map(r => r.DocRef_v));
        console.log('Last 5 results:', rows.slice(-5).map(r => r.DocRef_v));
      }
      
      const jobOrders = rows.map(row => ({
        id: row.TxnId_i,
        reference: row.DocRef_v,
        display: `${row.DocRef_v} - [${row.product_code || ''}] ${row.product_name || ''} #${row.TxnId_i}`
      }));
      
      return res.json({
        success: true,
        job_orders: jobOrders
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching job orders:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 