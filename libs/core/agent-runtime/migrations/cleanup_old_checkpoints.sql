-- Cleanup Script: Remove old checkpoints to prevent table bloat
-- Description: Deletes checkpoints older than specified retention period
-- Usage: Execute this script periodically (via cron or scheduled job)

-- Configuration: Set retention period (default: 30 days)
-- Adjust this value based on your requirements
DO $$
DECLARE
  retention_days INTEGER := 30;  -- Change this value as needed
  deleted_count INTEGER;
BEGIN
  -- Delete old checkpoints
  WITH deleted AS (
    DELETE FROM checkpoints
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Log the cleanup result
  RAISE NOTICE 'Deleted % checkpoints older than % days', deleted_count, retention_days;
END $$;

-- Alternative: Keep only the N most recent checkpoints per thread
-- Uncomment and adjust as needed:

/*
DO $$
DECLARE
  deleted_count INTEGER;
  max_checkpoints_per_thread INTEGER := 10;  -- Keep only 10 most recent per thread
BEGIN
  WITH ranked_checkpoints AS (
    SELECT
      thread_id,
      checkpoint_id,
      ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY created_at DESC) as rn
    FROM checkpoints
  ),
  to_delete AS (
    SELECT thread_id, checkpoint_id
    FROM ranked_checkpoints
    WHERE rn > max_checkpoints_per_thread
  ),
  deleted AS (
    DELETE FROM checkpoints
    WHERE (thread_id, checkpoint_id) IN (SELECT thread_id, checkpoint_id FROM to_delete)
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % old checkpoints (kept max % per thread)', deleted_count, max_checkpoints_per_thread;
END $$;
*/

-- Get cleanup statistics
SELECT
  'Before Cleanup' as phase,
  COUNT(*) as total_checkpoints,
  COUNT(DISTINCT thread_id) as unique_threads,
  pg_size_pretty(pg_total_relation_size('checkpoints')) as table_size,
  MIN(created_at) as oldest_checkpoint,
  MAX(created_at) as newest_checkpoint
FROM checkpoints;

-- Vacuum to reclaim space
VACUUM ANALYZE checkpoints;

-- Get cleanup statistics after vacuum
SELECT
  'After Cleanup' as phase,
  COUNT(*) as total_checkpoints,
  COUNT(DISTINCT thread_id) as unique_threads,
  pg_size_pretty(pg_total_relation_size('checkpoints')) as table_size,
  MIN(created_at) as oldest_checkpoint,
  MAX(created_at) as newest_checkpoint
FROM checkpoints;
