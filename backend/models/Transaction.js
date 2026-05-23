const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  runId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Run",
    required: true,
    index: true,
  },
  source: {
    type: String,
    enum: ["USER", "EXCHANGE"],
    required: true,
    index: true,
  },
  transaction_id: { type: String, required: true },

  // Cleaned and normalized fields for matching calculations
  timestamp: { type: Date, default: null },
  rawTimestamp: { type: String },
  type: { type: String, default: null },
  asset: { type: String, default: null },
  quantity: { type: Number, default: null },
  price_usd: { type: Number, default: null },
  fee: { type: Number, default: 0 },
  note: { type: String, default: "" },

  // Data ingestion quality metrics
  validationStatus: {
    type: String,
    enum: ["VALID", "INVALID"],
    default: "VALID",
    index: true,
  },
  errorReason: { type: String, default: null },

  // Output reconciliation state
  reconStatus: {
    type: String,
    enum: ["UNPROCESSED", "MATCHED", "CONFLICTING", "UNMATCHED"],
    default: "UNPROCESSED",
    index: true,
  },
  matchedWithTxId: { type: String, default: null },
  reconReason: { type: String, default: null },
});

// Composite optimized index for lookups during matching logic execution
TransactionSchema.index({
  runId: 1,
  source: 1,
  asset: 1,
  type: 1,
  validationStatus: 1,
});

module.exports = mongoose.model("Transaction", TransactionSchema);
