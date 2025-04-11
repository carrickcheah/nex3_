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
    const connection = await pool.getConnection();
    
    try {
      // Query to get active job orders with product details
      const [rows] = await connection.query(`
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
        ORDER BY 
          j.DocRef_v DESC
        LIMIT 20
      `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
      
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