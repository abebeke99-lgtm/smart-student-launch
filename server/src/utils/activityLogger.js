const ActivityLog = require('../models/ActivityLog');

function logAdminChange(req, action, entity, entityId, metadata = {}) {
  return ActivityLog.create({
    user: req.user._id,
    action,
    entity,
    entityId,
    ipAddress: req.ip,
    metadata,
  });
}

module.exports = logAdminChange;
