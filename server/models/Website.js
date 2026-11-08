import mongoose from 'mongoose';

const websiteSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Website name is required'],
      trim: true,
      maxlength: [100, 'Website name cannot exceed 100 characters']
    },
    url: {
      type: String,
      required: [true, 'Target URL is required'],
      trim: true
    },
    isMonitoringEnabled: {
      type: Boolean,
      default: true,
      index: true
    },
    lastStatus: {
      type: String,
      enum: ['UP', 'DOWN', 'PENDING'],
      default: 'PENDING'
    },
    lastCheckedAt: {
      type: Date,
      default: null,
      index: true
    },
    lastResponseTimeMs: {
      type: Number,
      default: null
    },
    lastHttpStatusCode: {
      type: Number,
      default: null
    },
    lastErrorMessage: {
      type: String,
      default: null
    },
    checkIntervalMinutes: {
      type: Number,
      default: 5,
      min: 1,
      max: 1440
    },
    timeoutMs: {
      type: Number,
      default: 10000,
      min: 1000,
      max: 60000
    },
    consecutiveFails: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

websiteSchema.index({ ownerId: 1, createdAt: -1 });
websiteSchema.index({ isMonitoringEnabled: 1, lastCheckedAt: 1 });

export default mongoose.model('Website', websiteSchema);
