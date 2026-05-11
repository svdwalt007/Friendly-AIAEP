-- Migration: Create checkpoints table for LangGraph state persistence
-- Description: This table stores agent conversation state and enables resuming sessions
-- Version: 1.0.0
-- Created: 2024

-- Note: This migration will be automatically applied by the PostgresCheckpointer.setup() method
-- You only need to run this manually if you want to create the table beforehand

-- Create checkpoints table
CREATE TABLE IF NOT EXISTS checkpoints (
  -- Thread identifier (unique conversation/session ID)
  thread_id TEXT NOT NULL,

  -- Checkpoint identifier (specific state snapshot)
  checkpoint_id TEXT NOT NULL,

  -- Parent checkpoint ID (for state history/versioning)
  parent_id TEXT,

  -- Serialized state data (JSONB for efficient querying)
  checkpoint JSONB NOT NULL,

  -- Additional metadata about the checkpoint
  metadata JSONB,

  -- Timestamp when checkpoint was created
  created_at TIMESTAMP DEFAULT NOW(),

  -- Primary key: combination of thread and checkpoint
  PRIMARY KEY (thread_id, checkpoint_id)
);

-- Index for efficient thread-based queries
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id
  ON checkpoints(thread_id);

-- Index for timestamp-based queries (useful for cleanup)
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at
  ON checkpoints(created_at);

-- Index for parent relationships (useful for state history)
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent_id
  ON checkpoints(parent_id)
  WHERE parent_id IS NOT NULL;

-- Add helpful comments
COMMENT ON TABLE checkpoints IS 'LangGraph agent state checkpoints for conversation persistence';
COMMENT ON COLUMN checkpoints.thread_id IS 'Unique conversation/session identifier (format: tenantId:userId:sessionId)';
COMMENT ON COLUMN checkpoints.checkpoint_id IS 'Unique checkpoint identifier for this state snapshot';
COMMENT ON COLUMN checkpoints.parent_id IS 'Reference to previous checkpoint (enables state history)';
COMMENT ON COLUMN checkpoints.checkpoint IS 'Serialized agent state (AEPAgentState)';
COMMENT ON COLUMN checkpoints.metadata IS 'Additional metadata (timestamps, versions, etc.)';
COMMENT ON COLUMN checkpoints.created_at IS 'Checkpoint creation timestamp';

-- Grant permissions (adjust based on your user/role)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON checkpoints TO aep_app_user;
