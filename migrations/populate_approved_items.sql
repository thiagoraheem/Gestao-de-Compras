-- Migration Script: Populate approved_quotation_items
-- Date: 2026-02-10
-- Description: Migrates historical data from supplier_quotations to the new approved_quotation_items snapshot table.
-- Handles partial selection logic (is_available check) and ensures data integrity.

BEGIN;

-- Log start
DO $$
BEGIN
    RAISE NOTICE 'Starting migration of approved quotation items...';
END $$;

-- 1. Create Temporary Table for Staging
-- This allows us to validate data before insertion
CREATE TEMP TABLE temp_migration_data AS
SELECT
    sq.quotation_id,
    sqi.id AS supplier_quotation_item_id,
    qi.purchase_request_item_id,
    -- Logic for Quantity: Use Supplier's available quantity if set, otherwise fallback to requested quantity
    COALESCE(sqi.available_quantity, CAST(qi.quantity AS DECIMAL(10,3))) AS approved_quantity,
    -- Logic for Unit Price
    sqi.unit_price,
    -- Logic for Total Price: Use discounted total if available (and > 0), otherwise total price
    CASE 
        WHEN sqi.discounted_total_price IS NOT NULL AND sqi.discounted_total_price > 0 THEN sqi.discounted_total_price
        ELSE sqi.total_price
    END AS total_price
FROM supplier_quotations sq
JOIN supplier_quotation_items sqi ON sq.id = sqi.supplier_quotation_id
JOIN quotation_items qi ON sqi.quotation_item_id = qi.id
WHERE
    sq.is_chosen = true -- Only winning quotations
    AND (sqi.is_available IS NULL OR sqi.is_available = true) -- Only items NOT marked as unavailable (Partial Selection Logic)
    AND qi.purchase_request_item_id IS NOT NULL; -- Ensure link to original request

-- 2. Pre-flight Validation
DO $$
DECLARE
    staging_count INT;
    duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO staging_count FROM temp_migration_data;
    RAISE NOTICE 'Found % items to migrate.', staging_count;

    -- Check for duplicates in the staging data (same item included twice for same quotation?)
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT quotation_id, supplier_quotation_item_id, COUNT(*)
        FROM temp_migration_data
        GROUP BY quotation_id, supplier_quotation_item_id
        HAVING COUNT(*) > 1
    ) dup;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Data Integrity Error: Found % duplicate entries in staging data. Aborting.', duplicate_count;
    END IF;
    
    IF staging_count = 0 THEN
        RAISE NOTICE 'No data found to migrate. This might be expected if no quotations are approved yet.';
    END IF;
END $$;

-- 3. Cleanup Existing Data (Idempotency)
-- Remove existing records for the quotations we are about to migrate to avoid unique constraint violations or duplicates
DELETE FROM approved_quotation_items
WHERE quotation_id IN (SELECT DISTINCT quotation_id FROM temp_migration_data);

-- 4. Insert Data
INSERT INTO approved_quotation_items (
    quotation_id,
    supplier_quotation_item_id,
    purchase_request_item_id,
    approved_quantity,
    unit_price,
    total_price,
    created_at
)
SELECT
    quotation_id,
    supplier_quotation_item_id,
    purchase_request_item_id,
    approved_quantity,
    unit_price,
    total_price,
    NOW()
FROM temp_migration_data;

-- 5. Post-Migration Verification
DO $$
DECLARE
    final_count INT;
    staging_count INT;
BEGIN
    SELECT COUNT(*) INTO staging_count FROM temp_migration_data;
    -- We count only the items we just inserted (by joining with temp table or checking created_at if we had a specific batch id, but counting all for the affected quotations is safer)
    SELECT COUNT(*) INTO final_count 
    FROM approved_quotation_items 
    WHERE quotation_id IN (SELECT DISTINCT quotation_id FROM temp_migration_data);

    IF final_count != staging_count THEN
        RAISE EXCEPTION 'Verification Failed: Expected % items, found % items in target table.', staging_count, final_count;
    ELSE
        RAISE NOTICE 'Success: Migrated % items successfully.', final_count;
    END IF;
END $$;

-- Cleanup
DROP TABLE temp_migration_data;

COMMIT;

-- Verification Query (Run manually if needed)
-- SELECT count(*) FROM approved_quotation_items;
