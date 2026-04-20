-- Migration: Add last_phase column to purchase_requests
-- This stores the phase a request was in before being archived,
-- enabling the "unarchive to previous phase" functionality for Buyers.
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS last_phase TEXT;
