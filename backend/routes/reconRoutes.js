const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const reconController = require("../controllers/reconController");

// Multer stream setup configuration to capture uploaded spreadsheet instances
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".csv") {
      return cb(
        new Error(
          "Only structured CSV files are accepted by this ingestion layer.",
        ),
      );
    }
    cb(null, true);
  },
});

const uploadFields = upload.fields([
  { name: "user_transactions", maxCount: 1 },
  { name: "exchange_transactions", maxCount: 1 },
]);

// Pipeline Routes Maps
router.post("/reconcile", uploadFields, reconController.triggerReconciliation);
router.get("/report/:runId", reconController.exportFullCSVReport);
router.get("/report/:runId/summary", reconController.getRunSummary);
router.get("/report/:runId/unmatched", reconController.getUnmatchedRows);

module.exports = router;
