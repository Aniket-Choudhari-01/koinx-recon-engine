import React, { useState } from "react";

// Use a relative path to cleanly leverage our Vite Proxy mapping
const HOST_BASE_API = "/api";

export default function ReconciliationDashboard() {
  // Form Upload State Vectors
  const [userFile, setUserFile] = useState(null);
  const [exchangeFile, setExchangeFile] = useState(null);
  const [timeTolerance, setTimeTolerance] = useState(300);
  const [qtyTolerance, setQtyTolerance] = useState(0.01);

  // Core Management State
  const [runId, setRunId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);

  // API Data Metrics Mapping
  const [summary, setSummary] = useState({
    matched: 0,
    conflicting: 0,
    unmatchedUser: 0,
    unmatchedExchange: 0,
    invalidUserRows: 0,
    invalidExchangeRows: 0,
  });
  const [unmatchedRecords, setUnmatchedRecords] = useState([]);
  const [invalidRows, setInvalidRows] = useState([]);

  // Form Submission Handler (Triggers Ingestion & Execution Pipeline)
  const handleReconcileSubmit = async (e) => {
    e.preventDefault();
    if (!userFile || !exchangeFile) {
      alert(
        "Please assign valid files to both upload dropzones before executing.",
      );
      return;
    }

    setIsLoading(true);
    try {
      const payloadData = new FormData();
      payloadData.append("user_transactions", userFile);
      payloadData.append("exchange_transactions", exchangeFile);
      payloadData.append("TIMESTAMP_TOLERANCE_SECONDS", timeTolerance);
      payloadData.append("QUANTITY_TOLERANCE_PCT", qtyTolerance);

      const response = await fetch(`${HOST_BASE_API}/reconcile`, {
        method: "POST",
        body: payloadData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server processing error occurred.");
      }

      const data = await response.json();
      setLookupId(data.runId);
      await fetchVisualDashboardData(data.runId);
    } catch (err) {
      alert(`Execution Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // DISPLAY SEPARATION CALL: Gathers analytics payload to construct data grids directly in the UI
  const fetchVisualDashboardData = async (targetRunId) => {
    if (!targetRunId) {
      alert("Please enter or generate a valid hexadecimal Run ID first.");
      return;
    }

    try {
      const [summaryRes, unmatchedRes] = await Promise.all([
        fetch(`${HOST_BASE_API}/report/${targetRunId}/summary`),
        fetch(`${HOST_BASE_API}/report/${targetRunId}/unmatched`),
      ]);

      if (!summaryRes.ok || !unmatchedRes.ok) {
        throw new Error(
          "Target workspace datasets could not be extracted cleanly from backend servers.",
        );
      }

      const summaryData = await summaryRes.json();
      const exceptionsData = await unmatchedRes.json();

      setRunId(targetRunId);
      setSummary(summaryData.summary);
      setUnmatchedRecords(exceptionsData.unmatched);
      setInvalidRows(exceptionsData.invalidRows);
      setDashboardVisible(true);
    } catch (err) {
      alert(`Data Extraction Error: ${err.message}`);
    }
  };

  // DOWNLOAD SEPARATION CALL: Explicitly fetches raw binary data stream arrays to save the styled Excel file
  const downloadExcelReport = async (targetRunId) => {
    if (!targetRunId) {
      alert(
        "A valid target workspace runId is required to stream down document binaries.",
      );
      return;
    }

    try {
      const response = await fetch(`${HOST_BASE_API}/report/${targetRunId}`);
      if (!response.ok) {
        throw new Error(
          "Target audit calculation workbook could not be located or compiled by server logs.",
        );
      }

      const binaryBlob = await response.blob();
      const downloadURL = window.URL.createObjectURL(binaryBlob);

      const trackingAnchor = document.createElement("a");
      trackingAnchor.href = downloadURL;
      trackingAnchor.download = `Reconciliation_Report_${targetRunId}.xlsx`;

      document.body.appendChild(trackingAnchor);
      trackingAnchor.click();

      trackingAnchor.remove();
      window.URL.revokeObjectURL(downloadURL);
    } catch (err) {
      alert(`File Downloader Failure: ${err.message}`);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-800 font-sans">
      {/* Branding Navigation Header Bar */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 py-5 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
              KoinX
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Enterprise Crypto Transaction Reconciliation Control Center (React
              Engine)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300 font-medium">
              React Matrix Engine Online
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* CONTROL DECK GRID */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* File Upload & Tolerance Setting Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex flex-row items-center gap-2">
              📁 Ingest Transaction Ledgers
            </h2>

            <form onSubmit={handleReconcileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User CSV File Input Card */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    User Ledger File (CSV)
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all duration-200">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 px-2 text-center">
                      <p className="text-sm text-gray-500 font-medium truncate max-w-xs">
                        {userFile ? userFile.name : "Click to upload user file"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        user_transactions.csv
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => setUserFile(e.target.files[0] || null)}
                    />
                  </label>
                </div>

                {/* Exchange CSV File Input Card */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Exchange Ledger File (CSV)
                  </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all duration-200">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 px-2 text-center">
                      <p className="text-sm text-gray-500 font-medium truncate max-w-xs">
                        {exchangeFile
                          ? exchangeFile.name
                          : "Click to upload exchange file"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        exchange_transactions.csv
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) =>
                        setExchangeFile(e.target.files[0] || null)
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Threshold Parameters Context Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Timestamp Window Tolerance
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <input
                      type="number"
                      className="w-full rounded-lg border-gray-300 border p-2.5 bg-gray-50 text-sm focus:ring-2 focus:ring-slate-500"
                      value={timeTolerance}
                      onChange={(e) => setTimeTolerance(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 text-xs">
                      Seconds
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Quantity Discrepancy Tolerance
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full rounded-lg border-gray-300 border p-2.5 bg-gray-50 text-sm focus:ring-2 focus:ring-slate-500"
                      value={qtyTolerance}
                      onChange={(e) => setQtyTolerance(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 text-xs">
                      % Percent
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:bg-slate-400 transition-all text-sm tracking-wide"
              >
                {isLoading
                  ? "🔄 Ingesting and Processing Computations..."
                  : "🚀 Execute Reconciliation Audit Run"}
              </button>
            </form>
          </div>

          {/* Historical Workspace Actions Management Block */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                🔍 Lookup Historical Run
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Provide an active hexadecimal run ID parameter below to fetch
                system performance states, summary maps, and audit logs.
              </p>
              <input
                type="text"
                className="w-full rounded-lg border-gray-300 border p-2.5 text-sm uppercase tracking-wider focus:ring-2 focus:ring-slate-500"
                placeholder="Paste workspace runId..."
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={() => fetchVisualDashboardData(lookupId.trim())}
                className="w-full py-2.5 px-4 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
              >
                Fetch Visual Analytics Data
              </button>
              <button
                onClick={() => downloadExcelReport(lookupId.trim())}
                className="w-full py-2.5 px-4 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                📥 Download Colored Excel Report
              </button>
            </div>
          </div>
        </section>

        {/* RESULTS METRICS & ANALYSIS DASHBOARD GRID (Conditional Rendering) */}
        {dashboardVisible && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Workspace Executive Report Dashboard
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Active Reference Target ID:{" "}
                  <span className="font-mono font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-800">
                    {runId}
                  </span>
                </p>
              </div>
              <button
                onClick={() => downloadExcelReport(runId)}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-all shadow-md flex items-center gap-2"
              >
                📥 Download Styled Excel Workbook File (.xlsx)
              </button>
            </div>

            {/* Quick Summary Cards Dashboard Overview Block */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Matched
                </span>
                <span className="text-3xl font-black text-emerald-700 mt-2">
                  {summary.matched}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium mt-1">
                  100% Light Green
                </span>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Conflicting
                </span>
                <span className="text-3xl font-black text-amber-700 mt-2">
                  {summary.conflicting}
                </span>
                <span className="text-[10px] text-amber-600 font-medium mt-1">
                  100% Light Yellow
                </span>
              </div>

              <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                  Unmatched (User)
                </span>
                <span className="text-3xl font-black text-rose-700 mt-2">
                  {summary.unmatchedUser}
                </span>
                <span className="text-[10px] text-rose-600 font-medium mt-1">
                  100% Light Red
                </span>
              </div>

              <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                  Unmatched (Exch)
                </span>
                <span className="text-3xl font-black text-rose-700 mt-2">
                  {summary.unmatchedExchange}
                </span>
                <span className="text-[10px] text-rose-600 font-medium mt-1">
                  100% Light Red
                </span>
              </div>

              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">
                  Invalid User Rows
                </span>
                <span className="text-3xl font-black text-orange-700 mt-2">
                  {summary.invalidUserRows || 0}
                </span>
                <span className="text-[10px] text-orange-600 font-medium mt-1">
                  Flagged Out
                </span>
              </div>

              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">
                  Invalid Exch Rows
                </span>
                <span className="text-3xl font-black text-orange-700 mt-2">
                  {summary.invalidExchangeRows || 0}
                </span>
                <span className="text-[10px] text-orange-600 font-medium mt-1">
                  Flagged Out
                </span>
              </div>
            </div>

            {/* SEPARATE DRILL DOWN INTERFACE TABLES DISPLAY */}
            <div className="grid grid-cols-1 gap-8">
              {/* Data Table 1: Valid but Unmatched Exceptions Output Stream */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="font-semibold text-white text-sm tracking-wide">
                    🔍 Detailed View: Unmatched Records Pipeline
                  </h3>
                  <span className="bg-rose-900 text-rose-200 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-rose-700">
                    Audit Exceptions
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-gray-200 text-xs font-bold uppercase text-gray-600 tracking-wider">
                        <th className="px-6 py-3">DataSource</th>
                        <th className="px-6 py-3">Transaction ID</th>
                        <th className="px-6 py-3">Timestamp Logged</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Asset</th>
                        <th className="px-6 py-3">Quantity</th>
                        <th className="px-6 py-3">
                          Reconciliation Exception Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {unmatchedRecords.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="px-6 py-4 text-center text-gray-400 italic bg-gray-50"
                          >
                            Zero tracking variations identified.
                          </td>
                        </tr>
                      ) : (
                        unmatchedRecords.map((tx, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-gray-50 transition-colors ${tx.source === "USER" ? "border-l-4 border-l-rose-400" : "border-l-4 border-l-indigo-400"}`}
                          >
                            <td className="px-6 py-3 font-semibold text-gray-700">
                              {tx.source}
                            </td>
                            <td className="px-6 py-3 font-mono text-gray-900">
                              {tx.transaction_id}
                            </td>
                            <td className="px-6 py-3 text-gray-500">
                              {tx.rawTimestamp}
                            </td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium">
                                {tx.type || "N/A"}
                              </span>
                            </td>
                            <td className="px-6 py-3 font-bold text-slate-800">
                              {tx.asset}
                            </td>
                            <td className="px-6 py-3 font-mono font-medium">
                              {tx.quantity}
                            </td>
                            <td className="px-6 py-3 text-rose-700 font-medium">
                              {tx.reason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Table 2: Baseline Data Quality Validation Exclusions Output Stream */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="font-semibold text-white text-sm tracking-wide">
                    ⚠️ Detailed View: Ingestion Integrity Exceptions (Invalid
                    Data Rows)
                  </h3>
                  <span className="bg-orange-900 text-orange-200 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-orange-700">
                    Ingestion Invalidation Logs
                  </span>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-gray-200 text-xs font-bold uppercase text-gray-600 tracking-wider">
                        <th className="px-6 py-3">Source Vector</th>
                        <th className="px-6 py-3">Target ID Pointer</th>
                        <th className="px-6 py-3">
                          Raw Timestamp String Provided
                        </th>
                        <th className="px-6 py-3">
                          Ingestion System Invalidation Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {invalidRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            className="px-6 py-4 text-center text-gray-400 italic bg-gray-50"
                          >
                            All processed structures cleared data validation
                            guards.
                          </td>
                        </tr>
                      ) : (
                        invalidRows.map((tx, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-gray-50 transition-colors bg-orange-50/40"
                          >
                            <td className="px-6 py-3 font-semibold text-orange-800">
                              {tx.source}
                            </td>
                            <td className="px-6 py-3 font-mono text-gray-600">
                              {tx.transaction_id}
                            </td>
                            <td className="px-6 py-3 text-gray-500">
                              {tx.rawTimestamp}
                            </td>
                            <td className="px-6 py-3 text-orange-700 font-semibold">
                              {tx.reason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
