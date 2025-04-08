const pool = require('../config/database');
const moment = require('moment');

/**
 * Daily Output Model - Database interactions for daily output functionality
 */
class DailyOutputModel {
  /**
   * Create a new daily output record
   * @param {Object} data - Daily output data
   * @returns {Promise<Object>} - Result with insertId
   */
  static async create(data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Insert daily transaction header
      const [result] = await connection.execute(`
        INSERT INTO tbl_daily_txn (
          Purpose_c, DocRef_v, TxnDate_dd, JoId_i, OwnerId_i,
          StartTime_tt, EndTime_tt, BreakTime_d, DocRemark_v,
          Status_c, SiteId_i, UpdateKey_i
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'A', ?, 1)
      `, [
        data.purpose,
        data.doc_ref,
        data.txn_date,
        data.jo_id,
        data.owner_id,
        data.start_time,
        data.end_time,
        data.break_time,
        data.doc_remark,
        data.site_id
      ]);
      
      const txn_id = result.insertId;
      
      // Process machines
      if (data.machine_id) {
        await this.insertMachine(connection, txn_id, data.machine_id);
      }
      
      // Process molds
      if (data.mold_id) {
        await this.insertMold(connection, txn_id, data.mold_id);
      }
      
      // Process operators
      if (data.operator_ids && Array.isArray(data.operator_ids)) {
        for (const operatorId of data.operator_ids) {
          await this.insertOperator(connection, txn_id, operatorId);
        }
      }
      
      // Process output items
      if (data.output_items && Array.isArray(data.output_items)) {
        for (let i = 0; i < data.output_items.length; i++) {
          const item = data.output_items[i];
          await this.insertOutputItem(
            connection, 
            txn_id, 
            item.product_id, 
            item.output_qty, 
            item.reject_qty || 0, 
            item.extra_qty || 0
          );
        }
      }
      
      // Process input items
      if (data.input_items && Array.isArray(data.input_items)) {
        for (let i = 0; i < data.input_items.length; i++) {
          const item = data.input_items[i];
          await this.insertInputItem(
            connection, 
            txn_id, 
            item.product_id, 
            item.demand_qty, 
            item.lot_id || null
          );
        }
      }
      
      await connection.commit();
      return { id: txn_id, success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update an existing daily output record
   * @param {Object} data - Daily output data
   * @returns {Promise<Object>} - Result with success status
   */
  static async update(data) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Update daily transaction header
      await this.updateDailyTransactionHeader(connection, data.txn_id, data);
      
      // Check if update was successful (optimistic locking)
      const [checkResult] = await this.checkUpdate(connection, data.txn_id);
      
      if (checkResult.length === 0 || checkResult[0].UpdateKey_i !== data.update_key + 1) {
        throw new Error('Record was modified by another user');
      }
      
      // Update machines (delete and insert)
      await this.deleteMachine(connection, data.txn_id);
      
      if (data.machine_id) {
        await this.insertMachine(connection, data.txn_id, data.machine_id);
      }
      
      // Update molds (delete and insert)
      await this.deleteMold(connection, data.txn_id);
      
      if (data.mold_id) {
        await this.insertMold(connection, data.txn_id, data.mold_id);
      }
      
      // Update operators (delete and insert)
      await this.deleteOperators(connection, data.txn_id);
      
      if (data.operator_ids && Array.isArray(data.operator_ids)) {
        for (const operatorId of data.operator_ids) {
          await this.insertOperator(connection, data.txn_id, operatorId);
        }
      }
      
      // Update output items (delete and insert)
      await this.deleteOutputItems(connection, data.txn_id);
      
      if (data.output_items && Array.isArray(data.output_items)) {
        for (let i = 0; i < data.output_items.length; i++) {
          const item = data.output_items[i];
          await this.insertOutputItem(
            connection, 
            data.txn_id, 
            item.product_id, 
            item.output_qty, 
            item.reject_qty || 0, 
            item.extra_qty || 0
          );
        }
      }
      
      // Update input items (delete and insert)
      await this.deleteInputItems(connection, data.txn_id);
      
      if (data.input_items && Array.isArray(data.input_items)) {
        for (let i = 0; i < data.input_items.length; i++) {
          const item = data.input_items[i];
          await this.insertInputItem(
            connection, 
            data.txn_id, 
            item.product_id, 
            item.demand_qty, 
            item.lot_id || null
          );
        }
      }
      
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get daily transaction details from database
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Transaction details
   */
  static async getDailyTransactionDetails(connection, txn_id) {
    return await connection.query(`
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
    `, [txn_id]);
  }

  /**
   * Insert daily transaction header
   * @param {Object} connection - Database connection
   * @param {Object} formData - Form data
   * @returns {Promise<Array>} - Insert result
   */
  static async insertDailyTransactionHeader(connection, formData) {
    return await connection.execute(`
      INSERT INTO tbl_daily_txn (
        Purpose_c, DocRef_v, TxnDate_dd, JoId_i, OwnerId_i,
        StartTime_tt, EndTime_tt, BreakTime_d, DocRemark_v,
        Status_c, SiteId_i, UpdateKey_i
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'A', ?, 1)
    `, [
      formData.purpose,
      formData.doc_ref,
      formData.txn_date,
      formData.jo_id,
      formData.owner_id,
      formData.start_time,
      formData.end_time,
      formData.break_time,
      formData.doc_remark,
      formData.site_id || 1
    ]);
  }

  /**
   * Update daily transaction header
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @param {Object} formData - Form data
   * @returns {Promise<Array>} - Update result
   */
  static async updateDailyTransactionHeader(connection, txn_id, formData) {
    return await connection.execute(`
      UPDATE tbl_daily_txn SET
        Purpose_c = ?,
        TxnDate_dd = ?,
        OwnerId_i = ?,
        StartTime_tt = ?,
        EndTime_tt = ?,
        BreakTime_d = ?,
        DocRemark_v = ?,
        UpdateKey_i = UpdateKey_i + 1
      WHERE TxnId_i = ? AND UpdateKey_i = ?
    `, [
      formData.purpose,
      formData.txn_date,
      formData.owner_id,
      formData.start_time,
      formData.end_time,
      formData.break_time,
      formData.doc_remark,
      txn_id,
      formData.update_key
    ]);
  }

  /**
   * Check update key for optimistic locking
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Update key check result
   */
  static async checkUpdate(connection, txn_id) {
    return await connection.execute(`
      SELECT UpdateKey_i FROM tbl_daily_txn WHERE TxnId_i = ?
    `, [txn_id]);
  }

  /**
   * Insert machine
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @param {number} machine_id - Machine ID
   * @returns {Promise<Array>} - Insert result
   */
  static async insertMachine(connection, txn_id, machine_id) {
    return await connection.execute(`
      INSERT INTO tbl_daily_machine (TxnId_i, MachineId_i, Selected_c)
      VALUES (?, ?, '1')
    `, [txn_id, machine_id]);
  }

  /**
   * Delete machine
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Delete result
   */
  static async deleteMachine(connection, txn_id) {
    return await connection.execute(`
      DELETE FROM tbl_daily_machine WHERE TxnId_i = ?
    `, [txn_id]);
  }

  /**
   * Insert mold
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @param {number} mold_id - Mold ID
   * @returns {Promise<Array>} - Insert result
   */
  static async insertMold(connection, txn_id, mold_id) {
    return await connection.execute(`
      INSERT INTO tbl_daily_mold (TxnId_i, MoldId_i, Selected_c)
      VALUES (?, ?, '1')
    `, [txn_id, mold_id]);
  }

  /**
   * Delete mold
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Delete result
   */
  static async deleteMold(connection, txn_id) {
    return await connection.execute(`
      DELETE FROM tbl_daily_mold WHERE TxnId_i = ?
    `, [txn_id]);
  }

  /**
   * Insert operator
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @param {number} operator_id - Operator ID
   * @returns {Promise<Array>} - Insert result
   */
  static async insertOperator(connection, txn_id, operator_id) {
    return await connection.execute(`
      INSERT INTO tbl_daily_operator (TxnId_i, UserId_i, Selected_c)
      VALUES (?, ?, '1')
    `, [txn_id, operator_id]);
  }

  /**
   * Delete operators
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Delete result
   */
  static async deleteOperators(connection, txn_id) {
    return await connection.execute(`
      DELETE FROM tbl_daily_operator WHERE TxnId_i = ?
    `, [txn_id]);
  }

  /**
   * Insert output item
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @param {number} item_id - Item ID
   * @param {number} output_qty - Output quantity
   * @param {number} reject_qty - Reject quantity
   * @param {number} extra_qty - Extra quantity
   * @returns {Promise<Array>} - Insert result
   */
  static async insertOutputItem(connection, txn_id, item_id, output_qty, reject_qty, extra_qty) {
    return await connection.execute(`
      INSERT INTO tbl_daily_item (
        TxnId_i, RowId_i, ProductId_i, ItemType_c,
        Qty_d, QtyReject_d, QtyExtra_d
      ) VALUES (?, ?, ?, 'O', ?, ?, ?)
    `, [txn_id, 1, item_id, output_qty, reject_qty, extra_qty]);
  }

  /**
   * Delete output items
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Delete result
   */
  static async deleteOutputItems(connection, txn_id) {
    return await connection.execute(`
      DELETE FROM tbl_daily_item WHERE TxnId_i = ? AND ItemType_c = 'O'
    `, [txn_id]);
  }

  /**
   * Insert input item
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @param {number} item_id - Item ID
   * @param {number} demand_qty - Demand quantity
   * @param {number} lot_id - Lot ID
   * @returns {Promise<Array>} - Insert result
   */
  static async insertInputItem(connection, txn_id, item_id, demand_qty, lot_id) {
    return await connection.execute(`
      INSERT INTO tbl_daily_item (
        TxnId_i, RowId_i, ProductId_i, ItemType_c,
        Qty_d, StockId_i
      ) VALUES (?, ?, ?, 'I', ?, ?)
    `, [txn_id, 1, item_id, demand_qty, lot_id]);
  }

  /**
   * Delete input items
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Delete result
   */
  static async deleteInputItems(connection, txn_id) {
    return await connection.execute(`
      DELETE FROM tbl_daily_item WHERE TxnId_i = ? AND ItemType_c = 'I'
    `, [txn_id]);
  }

  /**
   * Get machines
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Array of machines
   */
  static async getMachines(connection, txn_id) {
    return await connection.query(`
      SELECT m.MachineId_i as machine_id, 
             m.MachineName_v as machine_name,
             dm.Selected_c as selected
      FROM tbl_comp_machine m
      LEFT JOIN tbl_daily_machine dm ON dm.MachineId_i = m.MachineId_i AND dm.TxnId_i = ?
      WHERE m.Status_c = 'A'
      ORDER BY m.MachineName_v
    `, [txn_id]);
  }

  /**
   * Get molds
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Array of molds
   */
  static async getMolds(connection, txn_id) {
    return await connection.query(`
      SELECT m.MoldId_i as mold_id, 
             m.MoldName_v as mold_name,
             dm.Selected_c as selected
      FROM tbl_comp_mold m
      LEFT JOIN tbl_daily_mold dm ON dm.MoldId_i = m.MoldId_i AND dm.TxnId_i = ?
      WHERE m.Status_c = 'A'
      ORDER BY m.MoldName_v
    `, [txn_id]);
  }

  /**
   * Get operators
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Array of operators
   */
  static async getOperators(connection, txn_id) {
    return await connection.query(`
      SELECT u.UserId_i as operator_id, 
             u.UserName_v as operator_name,
             du.Selected_c as selected
      FROM tbl_user u
      LEFT JOIN tbl_daily_operator du ON du.UserId_i = u.UserId_i AND du.TxnId_i = ?
      WHERE u.Status_c = 'A' AND u.UserGroup_c = 'O'
      ORDER BY u.UserName_v
    `, [txn_id]);
  }

  /**
   * Process items and batches
   * @param {Object} connection - Database connection
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Object>} - Object with input and output items
   */
  static async processItemsAndBatches(connection, txn_id) {
    // Get output items
    const [outputRows] = await connection.query(`
      SELECT di.*, p.ProductCode_v, p.ProductName_v,
             CONCAT('(',p.ProductCode_v,') ',p.ProductName_v) as product_description
      FROM tbl_daily_item di
      LEFT JOIN tbl_product p ON p.ProductId_i = di.ProductId_i
      WHERE di.TxnId_i = ? AND di.ItemType_c = 'O'
      ORDER BY di.RowId_i
    `, [txn_id]);
    
    // Get input items
    const [inputRows] = await connection.query(`
      SELECT di.*, p.ProductCode_v, p.ProductName_v,
             CONCAT('(',p.ProductCode_v,') ',p.ProductName_v) as product_description
      FROM tbl_daily_item di
      LEFT JOIN tbl_product p ON p.ProductId_i = di.ProductId_i
      WHERE di.TxnId_i = ? AND di.ItemType_c = 'I'
      ORDER BY di.RowId_i
    `, [txn_id]);
    
    // Process output items
    const outputItems = outputRows.map(item => ({
      id: item.RowId_i,
      product_id: item.ProductId_i,
      product_description: item.product_description,
      output_qty: item.Qty_d,
      reject_qty: item.QtyReject_d || 0,
      extra_qty: item.QtyExtra_d || 0,
      total_qty: parseFloat(item.Qty_d) + parseFloat(item.QtyReject_d || 0) + parseFloat(item.QtyExtra_d || 0),
      outstanding: item.QtyBalance_d || 0,
      value: item.Amount_d || 0
    }));
    
    // Process input items and get available lots
    const inputItems = [];
    for (const item of inputRows) {
      const [lotRows] = await connection.query(`
        SELECT sb.StockId_i, sb.BatchCode_v, sb.QtyBalance_d
        FROM tbl_stock_batch sb
        WHERE sb.ProductId_i = ? AND sb.QtyBalance_d > 0
        ORDER BY sb.CreateDate_dt
      `, [item.ProductId_i]);
      
      const lot_options = lotRows.map(lot => ({
        value: lot.StockId_i,
        text: `${lot.BatchCode_v} (${lot.QtyBalance_d})`,
        selected: lot.StockId_i === item.StockId_i
      }));
      
      inputItems.push({
        id: item.RowId_i,
        product_id: item.ProductId_i,
        product_description: item.product_description,
        prd_avail: item.QtyBalance_d || 0,
        demand_qty: item.Qty_d || 0,
        lot_options: lot_options
      });
    }
    
    return {
      output: outputItems,
      input: inputItems
    };
  }

  /**
   * Get available products
   * @param {Object} connection - Database connection
   * @returns {Promise<Array>} - Array of products
   */
  static async getAvailableProducts(connection) {
    return await connection.query(`
      SELECT p.ProductId_i as product_id, 
             CONCAT('(',p.ProductCode_v,') ',p.ProductName_v) as product_name
      FROM tbl_product p
      WHERE p.Status_c = 'A' AND p.ProductType_c = 'F'
      ORDER BY p.ProductName_v
    `);
  }

  /**
   * Generate document reference
   * @param {Object} dbData - Database data
   * @returns {Promise<string>} - Document reference
   */
  static async generateDocReference(dbData) {
    // This would typically query the database for the next available reference number
    // For simplicity, we'll just generate a timestamp-based reference
    const prefix = 'DO';
    const date = moment().format('YYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `${prefix}${date}${random}`;
  }

  /**
   * Find a daily output record by ID
   * @param {number} id - Transaction ID
   * @returns {Promise<Object>} - Daily output record
   */
  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      // Query daily transaction details
      const [rows] = await connection.query(`
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
      `, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get machines for a transaction
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Array of machines
   */
  static async getMachines(txn_id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
        SELECT m.MachineId_i as machine_id, 
               m.MachineName_v as machine_name,
               dm.Selected_c as selected
        FROM tbl_comp_machine m
        LEFT JOIN tbl_daily_machine dm ON dm.MachineId_i = m.MachineId_i AND dm.TxnId_i = ?
        WHERE m.Status_c = 'A'
        ORDER BY m.MachineName_v
      `, [txn_id]);
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get molds for a transaction
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Array of molds
   */
  static async getMolds(txn_id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
        SELECT m.MoldId_i as mold_id, 
               m.MoldName_v as mold_name,
               dm.Selected_c as selected
        FROM tbl_comp_mold m
        LEFT JOIN tbl_daily_mold dm ON dm.MoldId_i = m.MoldId_i AND dm.TxnId_i = ?
        WHERE m.Status_c = 'A'
        ORDER BY m.MoldName_v
      `, [txn_id]);
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get operators for a transaction
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Array>} - Array of operators
   */
  static async getOperators(txn_id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
        SELECT u.UserId_i as operator_id, 
               u.UserName_v as operator_name,
               du.Selected_c as selected
        FROM tbl_user u
        LEFT JOIN tbl_daily_operator du ON du.UserId_i = u.UserId_i AND du.TxnId_i = ?
        WHERE u.Status_c = 'A' AND u.UserGroup_c = 'O'
        ORDER BY u.UserName_v
      `, [txn_id]);
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get items for a transaction
   * @param {number} txn_id - Transaction ID
   * @returns {Promise<Object>} - Object with input and output items
   */
  static async getItems(txn_id) {
    const connection = await pool.getConnection();
    try {
      // Get output items
      const [outputRows] = await connection.query(`
        SELECT di.*, p.ProductCode_v, p.ProductName_v,
               CONCAT('(',p.ProductCode_v,') ',p.ProductName_v) as product_description
        FROM tbl_daily_item di
        LEFT JOIN tbl_product p ON p.ProductId_i = di.ProductId_i
        WHERE di.TxnId_i = ? AND di.ItemType_c = 'O'
        ORDER BY di.RowId_i
      `, [txn_id]);
      
      // Get input items
      const [inputRows] = await connection.query(`
        SELECT di.*, p.ProductCode_v, p.ProductName_v,
               CONCAT('(',p.ProductCode_v,') ',p.ProductName_v) as product_description
        FROM tbl_daily_item di
        LEFT JOIN tbl_product p ON p.ProductId_i = di.ProductId_i
        WHERE di.TxnId_i = ? AND di.ItemType_c = 'I'
        ORDER BY di.RowId_i
      `, [txn_id]);
      
      return {
        output: outputRows,
        input: inputRows
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get available product batches for a product
   * @param {number} product_id - Product ID
   * @returns {Promise<Array>} - Array of batches
   */
  static async getProductBatches(product_id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
        SELECT sb.StockId_i, sb.BatchCode_v, sb.QtyBalance_d
        FROM tbl_stock_batch sb
        WHERE sb.ProductId_i = ? AND sb.QtyBalance_d > 0
        ORDER BY sb.CreateDate_dt
      `, [product_id]);
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get available products
   * @returns {Promise<Array>} - Array of products
   */
  static async getAvailableProducts() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
        SELECT p.ProductId_i as product_id, 
               CONCAT('(',p.ProductCode_v,') ',p.ProductName_v) as product_name
        FROM tbl_product p
        WHERE p.Status_c = 'A' AND p.ProductType_c = 'F'
        ORDER BY p.ProductName_v
      `);
      
      return rows;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Search daily output records
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Search results
   */
  static async search(criteria) {
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT d.TxnId_i, d.DocRef_v, d.TxnDate_dd, 
               d.Purpose_c, d.Status_c, d.Void_c,
               j.DocRef_v AS jo_reference,
               u.UserAbbrev_v as owner_abbrev,
               stt.StatusName_v, stt.StatusCss_v
        FROM tbl_daily_txn d 
        LEFT JOIN tbl_jo_txn j ON j.TxnId_i = d.JoId_i
        LEFT JOIN tbl_user u ON u.UserId_i = d.OwnerId_i	
        LEFT JOIN tbl_status stt ON stt.Status_c = d.Status_c
        WHERE 1=1 
      `;
      
      const params = [];
      
      // Add search filters
      if (criteria.fromDate && criteria.toDate) {
        query += ` AND d.TxnDate_dd BETWEEN ? AND ?`;
        params.push(criteria.fromDate, criteria.toDate);
      }
      
      if (criteria.reference) {
        query += ` AND d.DocRef_v LIKE ?`;
        params.push(`%${criteria.reference}%`);
      }
      
      if (criteria.status) {
        query += ` AND d.Status_c = ?`;
        params.push(criteria.status);
      }
      
      if (criteria.jo) {
        query += ` AND j.DocRef_v LIKE ?`;
        params.push(`%${criteria.jo}%`);
      }
      
      // Add order by
      query += ` ORDER BY d.TxnDate_dd DESC, d.TxnId_i DESC`;
      
      // Add limit and offset for pagination
      if (criteria.limit) {
        query += ` LIMIT ?`;
        params.push(parseInt(criteria.limit, 10));
        
        if (criteria.offset) {
          query += ` OFFSET ?`;
          params.push(parseInt(criteria.offset, 10));
        }
      }
      
      const [rows] = await connection.query(query, params);
      
      // Get total count for pagination
      const [countRows] = await connection.query(`
        SELECT COUNT(*) as total
        FROM tbl_daily_txn d 
        LEFT JOIN tbl_jo_txn j ON j.TxnId_i = d.JoId_i
        WHERE 1=1 
        ${criteria.fromDate && criteria.toDate ? 'AND d.TxnDate_dd BETWEEN ? AND ?' : ''}
        ${criteria.reference ? 'AND d.DocRef_v LIKE ?' : ''}
        ${criteria.status ? 'AND d.Status_c = ?' : ''}
        ${criteria.jo ? 'AND j.DocRef_v LIKE ?' : ''}
      `, params.slice(0, params.length - (criteria.limit ? (criteria.offset ? 2 : 1) : 0)));
      
      return {
        rows,
        total: countRows[0].total
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Get machine breaktime records for a specific transaction
   * @param {number} txnId - The transaction ID
   * @returns {Promise<Array>} - Array of breaktime records
   */
  static async getMachineBreaktime(txnId) {
    try {
      const [rows] = await this.pool.query(
        `SELECT mb.*, m.MachineName_v AS MachineName
         FROM tbl_daily_machine_breaktime mb
         LEFT JOIN tbl_machine m ON mb.MachineId_i = m.MachineId_i
         WHERE mb.TxnId_i = ?`,
        [txnId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching machine breaktime:', error);
      throw error;
    }
  }

  /**
   * Add machine breaktime record
   * @param {Object} breaktimeData - The breaktime data 
   * @returns {Promise<Object>} - Result of the operation
   */
  static async addMachineBreaktime(breaktimeData) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const [result] = await connection.query(
        `INSERT INTO tbl_daily_machine_breaktime 
         (TxnId_i, MachineId_i, StartTime_t, EndTime_t, Reason_v) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          breaktimeData.txnId,
          breaktimeData.machineId,
          breaktimeData.startTime,
          breaktimeData.endTime,
          breaktimeData.reason
        ]
      );
      
      await connection.commit();
      return { success: true, id: result.insertId };
    } catch (error) {
      await connection.rollback();
      console.error('Error adding machine breaktime:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update machine breaktime record
   * @param {number} breaktimeId - The breaktime record ID
   * @param {Object} breaktimeData - The breaktime data to update
   * @returns {Promise<Object>} - Result of the operation
   */
  static async updateMachineBreaktime(breaktimeId, breaktimeData) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      await connection.query(
        `UPDATE tbl_daily_machine_breaktime 
         SET StartTime_t = ?, EndTime_t = ?, Reason_v = ?
         WHERE BreaktimeId_i = ?`,
        [
          breaktimeData.startTime,
          breaktimeData.endTime,
          breaktimeData.reason,
          breaktimeId
        ]
      );
      
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      console.error('Error updating machine breaktime:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete machine breaktime record
   * @param {number} breaktimeId - The breaktime record ID
   * @returns {Promise<Object>} - Result of the operation
   */
  static async deleteMachineBreaktime(breaktimeId) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      
      await connection.query(
        'DELETE FROM tbl_daily_machine_breaktime WHERE BreaktimeId_i = ?',
        [breaktimeId]
      );
      
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting machine breaktime:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = DailyOutputModel;
