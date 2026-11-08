import mongoose from 'mongoose';

const monitoringCheckSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: true,
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    checkedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    status: {
      type: String,
      enum: ['UP', 'DOWN'],
      required: true,
      index: true
    },
    responseTimeMs: {
      type: Number,
      required: true
    },
    httpStatusCode: {
      type: Number,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    failureType: {
      type: String,
      enum: ['NONE', 'HTTP_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'DNS_ERROR', 'BLOCKED_SSRF', 'ACCESS_DENIED', 'RATE_LIMITED', 'OTHER'],
      default: 'NONE'
    },
    resolvedIp: {
      type: String,
      default: null
    }
  },
  {
    timestamps: false
  }
);

// Compound indexes for fast lookup and time-series queries
monitoringCheckSchema.index({ websiteId: 1, checkedAt: -1 });
monitoringCheckSchema.index({ ownerId: 1, checkedAt: -1 });

export default mongoose.model('MonitoringCheck', monitoringCheckSchema);
