-- Additive index only. Speeds up gamification point lookups (gymId+entity+action+entityId),
-- which previously fell back to a sequential scan over the entire audit_logs table.
CREATE INDEX "audit_logs_gymId_entity_action_entityId_idx" ON "audit_logs"("gymId", "entity", "action", "entityId");
