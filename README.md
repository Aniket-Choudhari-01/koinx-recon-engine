# 🪙 KoinX Crypto Transaction Reconciliation Engine

An enterprise-grade, full-stack financial auditing engine designed to ingest, validate, match, and reconcile disjoint cryptocurrency ledger pipelines (User Exports vs. Exchange Exports). Built with an asynchronous **Node.js (Express)** backend layer, **MongoDB (Mongoose)** persistence, and a highly responsive **React.js (Vite + Tailwind CSS)** analytical control center.

---

## 🔗 Project Navigation Hub

* 🌐 **Live Application Platform:** [Deploy Web Link - Click Here](https://koinx-recon-engine.vercel.app/)
* 📺 **Video Demo Walkthrough:** [Loom / YouTube Video Link - Click Here](YOUR_VIDEO_WALKTHROUGH_URL_HERE)
* 📂 **Interactive API Specs:** [Skip to Endpoint Blueprint](#-api-endpoints-blueprint)
* 🛠️ **Local Development Installation:** [Skip to Quick Setup Guide](#%EF%B8%8F-local-deployment--setup-guide)

---

## 🚀 System Logic & Core Engineering Principles

The engine acts as a deterministic automated accounting auditor. It moves away from naive nested-loop $O(N \times M)$ comparisons, optimizing for sub-millisecond execution patterns even when scales grow up to millions of records.

### 1. Stream-Based Ingestion Gatekeeper ($O(1)$ Memory Safety)
Loading entire spreadsheet file records into server RAM blocks heap memory allocation, causing engine crashes at production scale. This pipeline leverages event-driven disk streams (`fs.createReadStream` + `csv-parser`). Rows are processed chunk-by-chunk, validated on the fly, and batched into the database without overhead.

### 2. Multi-Tier Data Quality Isolation
Dirty rows are caught by an inline structure validator. Malformed dates (e.g., `2024-03-09T`), missing IDs, or negative values are flagged as `validationStatus: "INVALID"` alongside a descriptive `errorReason`. These records are isolated from the math matching engine to prevent false calculations, but are preserved for visibility in the UI and report exports.

### 3. Sliding Time-Window Bucketing
To locate transaction counterparts, the algorithm filters targets using compound database indices (`runId` + `source` + `asset` + `type`). For any user transaction, the bounds of exchange candidate rows are limited by a configurable second delta threshold:
$$\lvert t_{\text{user}} - t_{\text{exchange}} \rvert \le T_{\text{tolerance}}$$

### 4. Mathematical Value Variance Assertions
Once bounded inside the temporal canvas, candidates are filtered via an exact value discrepancy percentage:
$$\frac{\lvert Q_{\text{user}} - Q_{\text{exchange}} \rvert}{Q_{\text{user}}} \times 100 \le P_{\text{tolerance}}$$

---

## 📝 Key Architectural Decisions & Resolved Ambiguities

Per the assignment specification criteria regarding edge-case mitigation and handling unclean source data, the following strategic systems choices were designed:

* **Mitigation of Double-Claiming Race Conditions:** If a user executes two identical transactions of `0.5 BTC` at the exact same minute, but the exchange log only records a single execution line item, a generic query would link *both* user rows to the single exchange row. To block this, an in-memory tracking hashmap (`assignedExchangeTxIds`) locks an exchange ID immediately upon successful pairing, ensuring strict 1-to-1 operational matching.
* **Cross-Perspective Type Translation Mapping:** Counterparty ledgers look different depending on ownership (e.g., `TRANSFER_OUT` from a hardware wallet appears as `TRANSFER_IN` on the exchange dashboard). The utility layer converts user transaction profiles to their inverse matching types before querying the candidate collections.
* **Asset Aliasing Canonicalization:** Users manually ledger transactions under casual asset strings (e.g., `bitcoin`, `Bitcoin`, or `BTC`). Ingestion normalizes all records down to international shorthand ticker protocols (uppercase uppercase string arrays) so that cross-matching scales cleanly.
* **Color-Coded Spreadsheet Design Enhancement:** Plain text CSV files cannot store visual cell fills, border constraints, or adaptive spacing definitions. The reporting layer utilizes OpenXML Workbook structures (**`.xlsx`**) via `exceljs`, generating clean pastel fills designed to streamline human review:
    * 🟢 **Light Green (`#E2EFDA`)**: `MATCHED` successfully inside configured tolerances.
    * 🟡 **Light Yellow (`#FFF2CC`)**: `CONFLICTING` proximity matches (matching asset/time window but breaching quantity boundary rules).
    * 🔴 **Light Red/Orange (`#FCE4D6`)**: Completely `UNMATCHED` entries or structurally `INVALID` input lines.

---

## 🔌 API Endpoints Blueprint

All REST endpoints accept optional payload overrides to modify matching tolerances dynamically without altering system configuration parameters.

| Method | Endpoint | Description | Payload Schema / Options |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/reconcile` | Triggers file streams, executes inline data cleaning, and runs the matching loop. | **Multipart Form-Data:**<br>• `user_transactions` (CSV file)<br>• `exchange_transactions` (CSV file)<br>• `TIMESTAMP_TOLERANCE_SECONDS` (Optional string override)<br>• `QUANTITY_TOLERANCE_PCT` (Optional string override) |
| **GET** | `/api/report/:runId` | Generates and downloads the side-by-side color-coded workbook sheets. | **URL Parameter:** `:runId`<br>*(Returns standard `application/vnd.openxmlformats` download file)* |
| **GET** | `/api/report/:runId/summary` | Fetches calculation counts for dashboards. | **URL Parameter:** `:runId`<br>*(Returns JSON collection count summary mapping)* |
| **GET** | `/api/report/:runId/unmatched` | Isolates all valid unmatched rows alongside structural anomalies. | **URL Parameter:** `:runId`<br>*(Returns detailed JSON exception payload)* |

---

## 💻 Technical Stack Matrix

* **Backend Server Infrastructure:** Node.js (v20+ / v22+ architecture), Express routing layer, Multer upload multi-part stream handling.
* **Data Persistence Layer:** MongoDB, Mongoose Object Data Modeling (ODM), compound logical querying indexing.
* **Client Interface Application:** React.js, Vite micro-bundler framework, Tailwind CSS component design frameworks.
* **Auditing Compiler:** ExcelJS OpenXML document compiler pipeline.

---

## 🛠️ Local Deployment & Setup Guide

### System Prerequisites
* Node.js installed locally on your system platform.
* MongoDB operational database instance listening on standard port `27017`.

### 1. Initialize and Start the Express Backend Layer
```bash
# Navigate to the backend service ecosystem
cd backend
npm install

# Instatiate your local runtime parameters
cp .env.example .env
# Adjust the MONGODB_URI connection string inside your .env if needed

npm start
```

### 2. Initialize and Start the React App
```bash
# Navigate to the React app workspace
cd ../frontend
npm install --legacy-peer-deps

# Spin up the local development web server instance
npm run dev
```

### 📂 Repository Directory Structural Map
```bash
koinx-recon-engine/
├── backend/
│   ├── config/          # Database persistence initializers
│   ├── controllers/     # Route endpoint operational controllers
│   ├── models/          # Mongoose run tracking schema models
│   ├── routes/          # Express route system blueprints
│   ├── services/        # Ingestion loops and core matching algorithms
│   ├── utils/           # Normalization lookup maps and file generation utilities
│   ├── server.js        # Main server system entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # React Dashboard component interface
│   │   ├── App.jsx      # Root component mounting layer
│   │   └── main.jsx     # App mounting entry point
│   ├── tailwind.config.js
│   └── package.json
├── sample_data/         # Ingestion mock testing files uploaded for easy review
│   ├── exchange_transactions.csv
│   └── user_transactions.csv
└── README.md
```
