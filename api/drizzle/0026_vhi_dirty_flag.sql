ALTER TABLE users ADD COLUMN vhi_dirty BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX users_vhi_dirty_idx ON users(vhi_dirty) WHERE vhi_dirty = true;
-- Mark all existing users as dirty to force a full recompute on next cycle
UPDATE users SET vhi_dirty = true;
