const ExcelJS = require("exceljs");
const Run = require("../models/Run");
const Transaction = require("../models/Transaction");
const ingestionService = require("../services/ingestionService");
const matchingEngine = require("../services/matchingEngine");
const { buildCSVReport } = require("../utils/csvGenerator");

exports.triggerReconciliation = async (req, res) => {
  try {
    if (
      !req.files ||
      !req.files["user_transactions"] ||
      !req.files["exchange_transactions"]
    ) {
      return res.status(400).json({
        error:
          "Missing mandatory source csv arrays: user_transactions & exchange_transactions",
      });
    }

    const timestampToleranceSeconds =
      parseInt(req.body.TIMESTAMP_TOLERANCE_SECONDS) ||
      parseInt(process.env.TIMESTAMP_TOLERANCE_SECONDS) ||
      300;
    const quantityTolerancePct =
      parseFloat(req.body.QUANTITY_TOLERANCE_PCT) ||
      parseFloat(process.env.QUANTITY_TOLERANCE_PCT) ||
      0.01;

    // Instantiate Audit Pipeline Model Context
    const activeRun = await Run.create({
      config: { timestampToleranceSeconds, quantityTolerancePct },
      status: "PROCESSING",
    });

    const userFile = req.files["user_transactions"][0];
    const exchangeFile = req.files["exchange_transactions"][0];

    // Streamed Data Processing Pipelines
    await ingestionService.parseAndStoreCSV(
      userFile.path,
      "USER",
      activeRun._id,
    );
    await ingestionService.parseAndStoreCSV(
      exchangeFile.path,
      "EXCHANGE",
      activeRun._id,
    );

    // Call reconciliation calculations safely inside an async loop execution
    await matchingEngine.executeMatchingLogic(activeRun);

    return res.status(201).json({
      message: "Reconciliation operation executed successfully.",
      runId: activeRun._id,
      config: activeRun.config,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal failure processing ingestion parameters.",
      details: err.message,
    });
  }
};

exports.getRunSummary = async (req, res) => {
  try {
    const runData = await Run.findById(req.params.runId);
    if (!runData)
      return res
        .status(404)
        .json({ error: "Requested matching run reference not located." });

    return res.json({
      runId: runData._id,
      status: runData.status,
      summary: runData.summary,
      config: runData.config,
      executedAt: runData.createdAt,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error pulling summary calculations.",
      details: err.message,
    });
  }
};

exports.getUnmatchedRows = async (req, res) => {
  try {
    const { runId } = req.params;

    // Pull valid but unmatched items
    const unmatchedRecords = await Transaction.find({
      runId,
      reconStatus: "UNMATCHED",
      validationStatus: "VALID",
    });

    // Explicitly group structural data invalidations alongside unmatched fields
    const structuralDataErrors = await Transaction.find({
      runId,
      validationStatus: "INVALID",
    });

    return res.json({
      runId,
      unmatchedCount: unmatchedRecords.length,
      invalidatedInputCount: structuralDataErrors.length,
      unmatched: unmatchedRecords.map((tx) => ({
        source: tx.source,
        transaction_id: tx.transaction_id,
        rawTimestamp: tx.rawTimestamp,
        type: tx.type,
        asset: tx.asset,
        quantity: tx.quantity,
        reason: tx.reconReason,
      })),
      invalidRows: structuralDataErrors.map((tx) => ({
        source: tx.source,
        transaction_id: tx.transaction_id,
        rawTimestamp: tx.rawTimestamp,
        reason: tx.errorReason,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to compile unmatched dataset vectors.",
      details: err.message,
    });
  }
};

exports.exportFullCSVReport = async (req, res) => {
  try {
    const { runId } = req.params;
    const targetRun = await Run.findById(runId);
    if (!targetRun) {
      return res
        .status(404)
        .json({ error: "Reconciliation workspace references not located." });
    }

    // Fetch transactions
    const allTxs = await Transaction.find({ runId });

    // Process records into structured, side-by-side reconciliation entries
    const reportRows = [];
    const processedExchangeTxIds = new Set();

    // Group user transactions with their matching exchange records
    const validUserTxs = allTxs.filter((t) => t.source === "USER");
    const exchangeMap = new Map(
      allTxs
        .filter((t) => t.source === "EXCHANGE")
        .map((t) => [t.transaction_id, t]),
    );

    for (const u of validUserTxs) {
      let linkedExchange = null;
      if (u.matchedWithTxId && exchangeMap.has(u.matchedWithTxId)) {
        linkedExchange = exchangeMap.get(u.matchedWithTxId);
        processedExchangeTxIds.add(u.matchedWithTxId);
      }

      reportRows.push({
        reconStatus:
          u.validationStatus === "INVALID" ? "INVALID_USER_ROW" : u.reconStatus,
        reconReason:
          u.validationStatus === "INVALID" ? u.errorReason : u.reconReason,
        user: u,
        exchange: linkedExchange,
      });
    }

    // Add exchange transactions that were completely unmatched or invalid
    for (const [exId, ex] of exchangeMap.entries()) {
      if (!processedExchangeTxIds.has(exId)) {
        reportRows.push({
          reconStatus:
            ex.validationStatus === "INVALID"
              ? "INVALID_EXCHANGE_ROW"
              : ex.reconStatus,
          reconReason:
            ex.validationStatus === "INVALID" ? ex.errorReason : ex.reconReason,
          user: null,
          exchange: ex,
        });
      }
    }

    // --- INSTANTIATE EXCEL WORKBOOK GENERATION PIPELINE ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reconciliation Audit Logs");

    // Define Spreadsheet Schema Columns with Explicit Width Boundaries
    worksheet.columns = [
      { header: "Recon Status", key: "reconStatus", width: 24 },
      { header: "Recon Reason", key: "reconReason", width: 50 },
      { header: "User Tx ID", key: "user_id", width: 15 },
      { header: "User Timestamp", key: "user_time", width: 24 },
      { header: "User Type", key: "user_type", width: 15 },
      { header: "User Asset", key: "user_asset", width: 12 },
      { header: "User Quantity", key: "user_qty", width: 16 },
      { header: "User Price", key: "user_price", width: 14 },
      { header: "User Fee", key: "user_fee", width: 12 },
      { header: "User Note", key: "user_note", width: 28 },
      { header: "Exchange Tx ID", key: "ex_id", width: 16 },
      { header: "Exchange Timestamp", key: "ex_time", width: 24 },
      { header: "Exchange Type", key: "ex_type", width: 16 },
      { header: "Exchange Asset", key: "ex_asset", width: 14 },
      { header: "Exchange Quantity", key: "ex_qty", width: 18 },
      { header: "Exchange Price", key: "ex_price", width: 14 },
      { header: "Exchange Fee", key: "ex_fee", width: 12 },
      { header: "Exchange Note", key: "ex_note", width: 28 },
    ];

    // Format Header Row (Dark Slate Blue Background with Bold White Text)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.height = 24;
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E78" },
      };
    });

    // Populate Data and Apply Contextual Background Color Themes
    reportRows.forEach((r) => {
      const rowData = {
        reconStatus: r.reconStatus,
        reconReason: r.reconReason,
        user_id: r.user?.transaction_id || "",
        user_time: r.user?.rawTimestamp || "",
        user_type: r.user?.type || "",
        user_asset: r.user?.asset || "",
        user_qty: r.user?.quantity || "",
        user_price: r.user?.price_usd || "",
        user_fee: r.user?.fee || "",
        user_note: r.user?.note || "",
        ex_id: r.exchange?.transaction_id || "",
        ex_time: r.exchange?.rawTimestamp || "",
        ex_type: r.exchange?.type || "",
        ex_asset: r.exchange?.asset || "",
        ex_qty: r.exchange?.quantity || "",
        ex_price: r.exchange?.price_usd || "",
        ex_fee: r.exchange?.fee || "",
        ex_note: r.exchange?.note || "",
      };

      const addedRow = worksheet.addRow(rowData);
      addedRow.height = 20;
      addedRow.alignment = { vertical: "middle" };

      // Determine the specific color scheme using our ARGB color matrix rules
      let backgroundHEX = "FFFFFFFF"; // Default White

      if (r.reconStatus === "MATCHED") {
        backgroundHEX = "FFE2EFDA"; // Light Pastel Green
      } else if (r.reconStatus === "CONFLICTING") {
        backgroundHEX = "FFFFF2CC"; // Light Pastel Yellow
      } else if (
        ["UNMATCHED", "INVALID_USER_ROW", "INVALID_EXCHANGE_ROW"].includes(
          r.reconStatus,
        )
      ) {
        backgroundHEX = "FFFCE4D6"; // Light Soft Red/Orange
      }

      // Loop through all row cells to paint canvas fills and gridline borders
      addedRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: backgroundHEX },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD9D9D9" } },
          left: { style: "thin", color: { argb: "FFD9D9D9" } },
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
          right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };
      });
    });

    // --- STREAM FORMATTED DOCUMENT DOWNLOAD DIRECTLY TO APP REQ-RES PIPELINE ---
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Reconciliation_Report_${runId}.xlsx`,
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return res.status(500).json({
      error: "Error rendering downloadable system auditing file.",
      details: err.message,
    });
  }
};
