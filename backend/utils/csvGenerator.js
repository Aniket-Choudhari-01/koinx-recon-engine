exports.buildCSVReport = (records) => {
  const headers = [
    "Recon_Status",
    "Recon_Reason",
    "User_Tx_ID",
    "User_Timestamp",
    "User_Type",
    "User_Asset",
    "User_Quantity",
    "User_Price",
    "User_Fee",
    "User_Note",
    "Exchange_Tx_ID",
    "Exchange_Timestamp",
    "Exchange_Type",
    "Exchange_Asset",
    "Exchange_Quantity",
    "Exchange_Price",
    "Exchange_Fee",
    "Exchange_Note",
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];

  for (const r of records) {
    const row = [
      escapeCSV(r.reconStatus),
      escapeCSV(r.reconReason),

      // User data metrics
      escapeCSV(r.user?.transaction_id),
      escapeCSV(r.user?.rawTimestamp),
      escapeCSV(r.user?.type),
      escapeCSV(r.user?.asset),
      escapeCSV(r.user?.quantity),
      escapeCSV(r.user?.price_usd),
      escapeCSV(r.user?.fee),
      escapeCSV(r.user?.note),

      // Exchange data metrics
      escapeCSV(r.exchange?.transaction_id),
      escapeCSV(r.exchange?.rawTimestamp),
      escapeCSV(r.exchange?.type),
      escapeCSV(r.exchange?.asset),
      escapeCSV(r.exchange?.quantity),
      escapeCSV(r.exchange?.price_usd),
      escapeCSV(r.exchange?.fee),
      escapeCSV(r.exchange?.note),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
};
