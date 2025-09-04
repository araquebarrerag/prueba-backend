import express from "express";
import mysql from "mysql2/promise";
import ordersRouter from "./routes/orders.js";

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

app.use("/", ordersRouter(pool));
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(3002, () => console.log("✅ Orders API en http://localhost:3002"));