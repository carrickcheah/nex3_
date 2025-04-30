



const db = require('../../../../config/database');

/**
 * Model class for handling database operations related to Sales Stock Codes (non-service items)
 * Interacts primarily with the `tbl_product_code` and `tbl_uom` tables.
 */
class SalesStockModel {

    /**
     * Helper function to retrieve the UomId_i based on the UomCode_v.
     * Used to convert frontend UOM codes ('PCS') to database IDs before saving.
     * @param {string} uomCode - The Unit of Measure code (e.g., 'PCS').
     * @returns {Promise<number|null>} The corresponding UomId_i or null if not found.
     */
    static async getUomIdByCode(uomCode) {
        if (!uomCode) return null;
        const [rows] = await db.query('SELECT UomId_i FROM tbl_uom WHERE UomCode_v = ? LIMIT 1', [uomCode]);
        return rows.length > 0 ? rows[0].UomId_i : null;
    }

    /**
     * Fetches a paginated list of active stock codes.
     * Handles searching, sorting, and joins with tbl_uom to get the UOM code.
     * Maps the database `Deleted_c` status to a frontend-friendly `status` (1/0).
     * Includes a fixed `price_decimal` based on the known schema of related price fields.
     * @param {number} page - Current page number.
     * @param {number} limit - Number of items per page.
     * @param {string} search - Search term for stock code or product name.
     * @param {string} sortField - Field name to sort by (from frontend).
     * @param {string} sortOrder - Sort order ('asc' or 'desc').
     * @returns {Promise<object>} Object containing data array and total count.
     */
    static async getAll(page, limit, search, sortField, sortOrder) {
        const offset = (page - 1) * limit;
        // Ensure sortField is a valid column name to prevent SQL injection
        // Updated valid fields to match DB schema
        const allowedSortFields = ['p.StkId_i', 'p.StkCode_v', 'p.ProdName_v', 'u.UomCode_v', 'p.Deleted_c', 'p.CreateDate_dt']; 
        // Map frontend sort fields to actual DB fields used in the query
        const sortFieldMap = {
            'id': 'p.StkId_i',
            'stock_code': 'p.StkCode_v',
            'product_name': 'p.ProdName_v',
            'base_uom': 'u.UomCode_v', // Sorting by code from joined table
            'status': 'p.Deleted_c',
             'created_at': 'p.CreateDate_dt'
            // price_decimal was removed as it's not a sortable DB field here
        };
        const safeSortField = sortFieldMap[sortField] || 'p.StkId_i'; // Default sort field
        const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Sanitize sort order

        const searchTerm = `%${search}%`;

        // Query for fetching data with pagination, search, and sorting - JOIN with tbl_uom
        const dataQuery = `
            SELECT 
                p.StkId_i as id, 
                p.StkCode_v as stock_code, 
                p.ProdName_v as product_name, 
                u.UomCode_v as base_uom, 
                p.Deleted_c, -- Fetch the actual status column
                p.CreateDate_dt as created_at,
                p.UpdateDate_dt as updated_at
                -- price_decimal removed from direct query
            FROM tbl_product_code p
            LEFT JOIN tbl_uom u ON p.UomId_i = u.UomId_i
            WHERE (p.StkCode_v LIKE ? OR p.ProdName_v LIKE ?) 
              AND p.Alias_c = '0' -- Assuming we only want base product codes, not aliases
              AND p.Deleted_c = '0' -- Filter for active items (assuming '0' is active)
            ORDER BY ${safeSortField} ${safeSortOrder}
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(dataQuery, [searchTerm, searchTerm, parseInt(limit), offset]);
        
        // Map Deleted_c to status (1 for Active '0', 0 for Inactive '1') for frontend compatibility
        // Add the fixed price_decimal value based on RefPrice_d schema definition
        const processedRows = rows.map(row => ({
            ...row,
            status: row.Deleted_c === '0' ? 1 : 0,
            price_decimal: 6 // Derived from RefPrice_d DECIMAL(14,6)
        }));

        // Query for total count matching the search criteria
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM tbl_product_code p 
            WHERE (p.StkCode_v LIKE ? OR p.ProdName_v LIKE ?) 
              AND p.Alias_c = '0' 
              AND p.Deleted_c = '0'
        `;
        const [countResult] = await db.query(countQuery, [searchTerm, searchTerm]);
        const total = countResult[0].total;

        return {
            data: processedRows, // Return processed rows with status field
            total: total
        };
    }

    /**
     * Fetches a single active stock code by its StkId_i.
     * Joins with tbl_uom to get the UOM code.
     * Maps `Deleted_c` to `status` and adds fixed `price_decimal`.
     * @param {number} id - The StkId_i of the stock code.
     * @returns {Promise<object|null>} Stock code object or null if not found/inactive.
     */
    static async getById(id) {
        const query = `
            SELECT 
                p.StkId_i as id, 
                p.StkCode_v as stock_code, 
                p.ProdName_v as product_name, 
                u.UomCode_v as base_uom, 
                p.Deleted_c, -- Fetch actual status
                p.CreateDate_dt as created_at,
                p.UpdateDate_dt as updated_at
                -- price_decimal removed
            FROM tbl_product_code p 
            LEFT JOIN tbl_uom u ON p.UomId_i = u.UomId_i
            WHERE p.StkId_i = ? AND p.Alias_c = '0' AND p.Deleted_c = '0'
        `;
        const [rows] = await db.query(query, [id]);
        
        if (rows.length === 0) return null;

        // Map Deleted_c to status for frontend
        // Add the fixed price_decimal value based on RefPrice_d schema definition
        const row = rows[0];
        const processedRow = {
            ...row,
            status: row.Deleted_c === '0' ? 1 : 0,
            price_decimal: 6 // Derived from RefPrice_d DECIMAL(14,6)
        };
        return processedRow; // Returns the stock code object or null if not found
    }

     /**
     * Checks if a stock code (StkCode_v) already exists for an active, non-alias item.
     * Optionally excludes a specific StkId_i (used during updates to prevent self-conflict).
     * @param {string} stock_code - The StkCode_v to check.
     * @param {number|null} excludeId - The StkId_i to exclude from the check.
     * @returns {Promise<boolean>} True if the code exists, false otherwise.
     */
    static async checkExists(stock_code, excludeId = null) {
        let query = 'SELECT StkId_i FROM tbl_product_code WHERE StkCode_v = ? AND Alias_c = \'0\' AND Deleted_c = \'0\'';
        const params = [stock_code];

        if (excludeId) {
            query += ' AND StkId_i != ?';
            params.push(excludeId);
        }

        const [rows] = await db.query(query, params);
        return rows.length > 0; // Returns true if exists, false otherwise
    }

    /**
     * Creates a new stock code entry in tbl_product_code.
     * Looks up UomId_i based on the provided base_uom code.
     * Maps the frontend status (1/0) to the database Deleted_c ('0'/'1').
     * Sets default values for several required columns.
     * @param {object} data - Object containing stock_code, product_name, base_uom, status.
     * @returns {Promise<number>} The StkId_i of the newly created stock code.
     * @throws {Error} If the base_uom code is invalid.
     */
    static async create(data) {
        const { stock_code, product_name, base_uom, status } = data; // price_decimal removed
        
        // Get UomId_i from base_uom code
        const uomId = await this.getUomIdByCode(base_uom);
        if (uomId === null) {
            throw new Error(`Invalid Base UOM code: ${base_uom}`);
        }
        
        // Map status (1=Active, 0=Inactive) to Deleted_c ('0'=Active, '1'=Inactive)
        const deletedC = (status === '1' || status === 1) ? '0' : '1';
        
        // Use actual column names. Provide defaults for required columns not in the form.
        const [result] = await db.query(`
            INSERT INTO tbl_product_code 
            (StkCode_v, ProdName_v, UomId_i, Deleted_c, Alias_c, CreateDate_dt, UpdateDate_dt, ItemId_i, ParentStkid_i, Qty_d, RoundUp_c, __BasicQty_d, __PuomId_i, __PconvertQty_d, __SuomId_i, __SconvertQty_d, MaxRefcost_d, RefCost_d, RefPrice_d, RefExpense_d, BomType_i, PureRouting_c, OwnerId_i, CreateId_i, UpdateId_i, CreatedFrom_c)
            VALUES (?, ?, ?, ?, '0', NOW(), NOW(), 0, 0, 1, '0', 1, ?, 1, ?, 1, 0, 0, 0, 0, 0, '0', 0, 1, 1, 'S') 
        `, [stock_code, product_name, uomId, deletedC, uomId, uomId]); // Use uomId, map status to deletedC, provide defaults

        return result.insertId; // Returns the ID of the newly created stock code
    }

     /**
     * Updates an existing stock code.
     * Looks up UomId_i based on the provided base_uom code.
     * Maps the frontend status (1/0) to the database Deleted_c ('0'/'1').
     * @param {number} id - The StkId_i of the stock code to update.
     * @param {object} data - Object containing stock_code, product_name, base_uom, status.
     * @returns {Promise<boolean>} True if the update was successful, false otherwise.
     * @throws {Error} If the base_uom code is invalid.
     */
    static async update(id, data) {
        const { stock_code, product_name, base_uom, status } = data; // price_decimal removed
        
        // Get UomId_i from base_uom code
        const uomId = await this.getUomIdByCode(base_uom);
        if (uomId === null) {
            throw new Error(`Invalid Base UOM code: ${base_uom}`);
        }
        
        // Map status (1=Active, 0=Inactive) to Deleted_c ('0'=Active, '1'=Inactive)
        const deletedC = (status === '1' || status === 1) ? '0' : '1';

        // Use actual column names
        const [result] = await db.query(`
            UPDATE tbl_product_code 
            SET StkCode_v = ?, 
                ProdName_v = ?, 
                UomId_i = ?, 
                Deleted_c = ?, 
                UpdateDate_dt = NOW()
                -- price_decimal removed
            WHERE StkId_i = ? AND Alias_c = '0' 
        `, [stock_code, product_name, uomId, deletedC, id]);

        return result.affectedRows > 0; // Returns true if the update was successful, false otherwise
    }

    /**
     * Soft deletes a stock code by setting its Deleted_c status to '1'.
     * @param {number} id - The StkId_i of the stock code to delete.
     * @returns {Promise<boolean>} True if the status was updated, false otherwise.
     */
    static async delete(id) {
        const [result] = await db.query(
            'UPDATE tbl_product_code SET Deleted_c = \'1\', UpdateDate_dt = NOW() WHERE StkId_i = ? AND Alias_c = \'0\'', 
            [id]
        );
        return result.affectedRows > 0; // Returns true if the status was updated, false otherwise
    }
}

module.exports = SalesStockModel;