import express from "express";
import mysql  from "mysql2/promise";
import customersRouter from "./routes/customers.js";

const app = express();
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

app.use("/customers", customersRouter(pool));
app.get("/health", (_, res) => res.json({ status: "OK" }));

app.listen(3001, () => console.log("Customers Api corriendo en http://localhost:3001"));