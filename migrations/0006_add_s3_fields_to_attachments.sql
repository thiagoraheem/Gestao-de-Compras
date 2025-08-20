-- Migration: Add S3 support fields to attachments table
-- This migration adds storage_type and s3_key fields to support S3 file storage

ALTER TABLE attachments 
ADD COLUMN storage_type TEXT DEFAULT 'local',
ADD COLUMN s3_key TEXT;

-- Add comment to document the purpose of this migration
COMMENT ON COLUMN attachments.storage_type IS 'Storage type: local or s3';
COMMENT ON COLUMN attachments.s3_key IS 'S3 object key for files stored in S3';

-- Create index on storage_type for efficient queries
CREATE INDEX idx_attachments_storage_type ON attachments(storage_type);

-- Create index on s3_key for S3 file lookups
CREATE INDEX idx_attachments_s3_key ON attachments(s3_key) WHERE s3_key IS NOT NULL;