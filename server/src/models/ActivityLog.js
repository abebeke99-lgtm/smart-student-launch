const mongoose = require('mongoose');

function appendOnlyError() {
  return new Error('Activity logs are append-only and cannot be modified or deleted');
}

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    entityType: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    entity: {
      type: String,
      required: [true, 'Entity is required'],
      trim: true,
      maxlength: 100,
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 45,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

activityLogSchema.pre('save', function enforceAppendOnly() {
  if (!this.isNew) throw appendOnlyError();
});

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
]) {
  activityLogSchema.pre(operation, function rejectUpdate() {
    throw appendOnlyError();
  });
}

for (const operation of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
  activityLogSchema.pre(operation, function rejectDelete() {
    throw appendOnlyError();
  });
}

activityLogSchema.pre('deleteOne', { document: true, query: false }, function rejectDocumentDelete() {
  throw appendOnlyError();
});

activityLogSchema.pre('bulkWrite', function rejectBulkMutation(next, operations) {
  if (operations.some((operation) => !Object.hasOwn(operation, 'insertOne'))) {
    return next(appendOnlyError());
  }
  next();
});

activityLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
