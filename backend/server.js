const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const reconRoutes = require("./routes/reconRoutes");
const fs = require("fs");

dotenv.config();
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "https://koinx-recon-engine.vercel.app/"],
    credentials: true,
  }),
);

if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", reconRoutes);

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(
      `Reconciliation Server operational and listening on Port: ${PORT}`,
    );
  });
});
