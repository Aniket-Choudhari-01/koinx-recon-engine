const fs = require("fs");
const csv = require("csv-parser");
const Transaction = require("../models/Transaction");
const { normalizeAsset } = require("../utils/normalizer");

exports.parseAndStoreCSV = (filePath, source, runId) => {
  return new Promise((resolve, reject) => {
    const batch = [];
    const seenTxIds = new Set();

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        let isValid = true;
        let errorReason = null;

        const rawTxId = row.transaction_id ? row.transaction_id.trim() : "";
        const rawType = row.type ? row.type.trim().toUpperCase() : "";
        const rawAsset = row.asset ? row.asset.trim() : "";
        const parsedQty = parseFloat(row.quantity);
        const parsedTimestamp = Date.parse(row.timestamp);

        // Comprehensive Data Quality Safeguard Executions
        if (!rawTxId || !row.timestamp || !rawAsset) {
          isValid = false;
          errorReason =
            "Missing key identifying parameters (transaction_id, timestamp, or asset)";
        } else if (isNaN(parsedTimestamp)) {
          isValid = false;
          errorReason = `Malformed timestamp entry formatting: "${row.timestamp}"`;
        } else if (isNaN(parsedQty)) {
          isValid = false;
          errorReason = `Quantity attribute is not a valid numerical input: "${row.quantity}"`;
        } else if (parsedQty <= 0) {
          isValid = false;
          errorReason = `Data error: Quantity possesses negative or zero calculation boundaries: ${row.quantity}`;
        } else if (seenTxIds.has(rawTxId)) {
          isValid = false;
          errorReason = `Data Ingestion Conflict: Detected internal duplicate unique transaction_id entry string: "${rawTxId}"`;
        }

        if (rawTxId && isValid) {
          seenTxIds.add(rawTxId);
        }

        batch.push({
          runId,
          source,
          transaction_id: rawTxId || "UNKNOWN_ID",
          timestamp: isValid ? new Date(parsedTimestamp) : null,
          rawTimestamp: row.timestamp || "",
          type: rawType || null,
          asset: rawAsset ? normalizeAsset(rawAsset) : null,
          quantity: isNaN(parsedQty) ? null : parsedQty,
          price_usd: row.price_usd ? parseFloat(row.price_usd) : null,
          fee: row.fee ? parseFloat(row.fee) : 0,
          note: row.note ? row.note.trim() : "",
          validationStatus: isValid ? "VALID" : "INVALID",
          errorReason: errorReason,
          reconStatus: "UNPROCESSED",
        });
      })
      .on("end", async () => {
        try {
          if (batch.length > 0) {
            await Transaction.insertMany(batch);
          }
          resolve(batch.length);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (err) => reject(err));
  });
};
