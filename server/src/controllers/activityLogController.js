const ActivityLog = require('../models/ActivityLog');

async function listActivityLogs(req, res) {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { action: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { entity: { $regex: escaped, $options: 'i' } },
    ];
  }
  if (req.query.startDate || req.query.endDate) {
    const start = req.query.startDate ? new Date(req.query.startDate) : new Date(0);
    const end = req.query.endDate ? new Date(req.query.endDate) : new Date();
    if (req.query.startDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate)) start.setUTCHours(0, 0, 0, 0);
    if (req.query.endDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate)) end.setUTCHours(23, 59, 59, 999);
    if (start > end) {
      const error = new Error('Start date must be on or before end date');
      error.statusCode = 400;
      throw error;
    }
    filter.createdAt = { $gte: start, $lte: end };
  }
  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ActivityLog.countDocuments(filter),
  ]);
  return res.status(200).json({
    success: true,
    data: { logs },
    pagination: { page, limit, total },
  });
}

module.exports = { listActivityLogs };
