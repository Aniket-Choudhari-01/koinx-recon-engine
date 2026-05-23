const mongoose = require("mongoose");

const RunSchema = new mongoose.Schema(
  {
    config: {
      timestampToleranceSeconds: { type: Number, required: true },
      quantityTolerancePct: { type: Number, required: true },
    },
    summary: {
      matched: { type: Number, default: 0 },
      conflicting: { type: Number, default: 0 },
      unmatchedUser: { type: Number, default: 0 },
      unmatchedExchange: { type: Number, default: 0 },
      invalidUserRows: { type: Number, default: 0 },
      invalidExchangeRows: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["PROCESSING", "COMPLETED", "FAILED"],
      default: "PROCESSING",
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Run", RunSchema);
