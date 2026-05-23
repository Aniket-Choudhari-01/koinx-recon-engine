const Transaction = require("../models/Transaction");
const { getEquivalentExchangeType } = require("../utils/normalizer");

exports.executeMatchingLogic = async (runObj) => {
  const timeToleranceMs = runObj.config.timestampToleranceSeconds * 1000;
  const quantityPctTolerance = runObj.config.quantityTolerancePct;

  // Step 1: Query internal collections to pull Valid transaction structures
  const userList = await Transaction.find({
    runId: runObj._id,
    source: "USER",
    validationStatus: "VALID",
  });
  const exchangeList = await Transaction.find({
    runId: runObj._id,
    source: "EXCHANGE",
    validationStatus: "VALID",
  });

  // Map exchange arrays cleanly to track in-memory binding assignments
  const assignedExchangeTxIds = new Set();

  let matchedCounter = 0;
  let conflictCounter = 0;

  // Step 2: Loop through User Rows and execute core multi-variant conditional matching
  for (const userTx of userList) {
    const requiredExchangeType = getEquivalentExchangeType(userTx.type);

    // Filter down to temporal and asset structural proximity parameters
    const structuralCandidates = exchangeList.filter((exTx) => {
      if (assignedExchangeTxIds.has(exTx.transaction_id)) return false;
      if (exTx.asset !== userTx.asset || exTx.type !== requiredExchangeType)
        return false;

      const varianceDelta = Math.abs(
        userTx.timestamp.getTime() - exTx.timestamp.getTime(),
      );
      return varianceDelta <= timeToleranceMs;
    });

    if (structuralCandidates.length === 0) {
      userTx.reconStatus = "UNMATCHED";
      userTx.reconReason =
        "No reciprocal transaction matching spatial parameters or structural time window limits found on exchange side.";
      await userTx.save();
      continue;
    }

    // Step 3: Run targeted value check assertions to isolate exact vs conflicting pairs
    let absoluteMatch = null;
    let fallbackConflictMatch = null;
    let minimumQtyDelta = Infinity;

    for (const prospect of structuralCandidates) {
      const actualQtyVariancePct =
        (Math.abs(userTx.quantity - prospect.quantity) / userTx.quantity) * 100;

      if (actualQtyVariancePct <= quantityPctTolerance) {
        absoluteMatch = prospect;
        break;
      } else {
        if (actualQtyVariancePct < minimumQtyDelta) {
          minimumQtyDelta = actualQtyVariancePct;
          fallbackConflictMatch = prospect;
        }
      }
    }

    // Step 4: Write states directly down to persistence layers
    if (absoluteMatch) {
      userTx.reconStatus = "MATCHED";
      userTx.matchedWithTxId = absoluteMatch.transaction_id;
      userTx.reconReason =
        "Paired across both sources successfully inside exact configuration constraints.";
      await userTx.save();

      absoluteMatch.reconStatus = "MATCHED";
      absoluteMatch.matchedWithTxId = userTx.transaction_id;
      absoluteMatch.reconReason =
        "Paired across both sources successfully inside exact configuration constraints.";
      await absoluteMatch.save();

      assignedExchangeTxIds.add(absoluteMatch.transaction_id);
      matchedCounter++;
    } else if (fallbackConflictMatch) {
      const varianceDetail = (
        (Math.abs(userTx.quantity - fallbackConflictMatch.quantity) /
          userTx.quantity) *
        100
      ).toFixed(4);

      userTx.reconStatus = "CONFLICTING";
      userTx.matchedWithTxId = fallbackConflictMatch.transaction_id;
      userTx.reconReason = `Time match validation clear, but quantity variance delta (${varianceDetail}%) breaches bounds.`;
      await userTx.save();

      fallbackConflictMatch.reconStatus = "CONFLICTING";
      fallbackConflictMatch.matchedWithTxId = userTx.transaction_id;
      fallbackConflictMatch.reconReason = `Time match validation clear, but quantity variance delta (${varianceDetail}%) breaches bounds.`;
      await fallbackConflictMatch.save();

      assignedExchangeTxIds.add(fallbackConflictMatch.transaction_id);
      conflictCounter++;
    }
  }

  // Step 5: Mark any remaining unprocessed records as unmatched
  await Transaction.updateMany(
    {
      runId: runObj._id,
      source: "USER",
      reconStatus: "UNPROCESSED",
      validationStatus: "VALID",
    },
    {
      reconStatus: "UNMATCHED",
      reconReason:
        "Transaction logged by user but completely missing from exchange export logs.",
    },
  );

  await Transaction.updateMany(
    {
      runId: runObj._id,
      source: "EXCHANGE",
      reconStatus: "UNPROCESSED",
      validationStatus: "VALID",
    },
    {
      reconStatus: "UNMATCHED",
      reconReason:
        "Transaction executed on-exchange but missing from tracking sheets logged by user.",
    },
  );

  // Step 6: Map data quality drop flags into final system counters
  const unmatchedUserCount = await Transaction.countDocuments({
    runId: runObj._id,
    source: "USER",
    reconStatus: "UNMATCHED",
    validationStatus: "VALID",
  });
  const unmatchedExchangeCount = await Transaction.countDocuments({
    runId: runObj._id,
    source: "EXCHANGE",
    reconStatus: "UNMATCHED",
    validationStatus: "VALID",
  });

  const invalidUserCount = await Transaction.countDocuments({
    runId: runObj._id,
    source: "USER",
    validationStatus: "INVALID",
  });
  const invalidExchangeCount = await Transaction.countDocuments({
    runId: runObj._id,
    source: "EXCHANGE",
    validationStatus: "INVALID",
  });

  runObj.summary = {
    matched: matchedCounter,
    conflicting: conflictCounter,
    unmatchedUser: unmatchedUserCount,
    unmatchedExchange: unmatchedExchangeCount,
    invalidUserRows: invalidUserCount,
    invalidExchangeRows: invalidExchangeCount,
  };

  runObj.status = "COMPLETED";
  await runObj.save();
};
