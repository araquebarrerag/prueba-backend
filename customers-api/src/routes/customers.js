import { Router } from "express";
import { z } from "zod";

export default function(pool) {
    const router = Router();

    router.post("/", async(req, res) => {
        const schema = z.object({
            name: z.string(),
            email: z.string().email(),
            phone: z.string()
        });

        try {
            const { name, email, phone } = schema.parse(req.body);
            const [result] = await pool.query(
                "INSERT INTO customers (name, email, phone, created_at) VALUES (?, ?, ?, NOW())",
                [name, email, phone]
            );
            res.status(201).json({ id: result.insertId, name, email, phone });
        } catch (error) {
            res.status(400).json({ error: err.message });
        }
    });

    router.get("/:id", async (req, res) => {
        const [rows] = await pool.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found" });
        res.json(rows[0]);
    });

    router.get("/", async (req, res) => {
        const { search = "", cursor = 0, limit = 10 } = req.query;
        const [rows] = await pool.query(
        "SELECT * FROM customers WHERE name LIKE ? OR email LIKE ? LIMIT ? OFFSET ?",
        [`%${search}%`, `%${search}%`, Number(limit), Number(cursor)]
        );
        res.json(rows);
    });

    router.put("/:id", async (req, res) => {
        const { name, email, phone } = req.body;
        await pool.query("UPDATE customers SET name=?, email=?, phone=? WHERE id=?", [
        name, email, phone, req.params.id
        ]);
        res.json({ id: req.params.id, name, email, phone });
    });

    router.delete("/:id", async (req, res) => {
        await pool.query("UPDATE customers SET deleted_at=NOW() WHERE id=?", [req.params.id]);
        res.json({ success: true });
    });

    router.get("/internal/:id", async (req, res) => {
        const auth = req.headers["authorization"];
        if (!auth || auth !== "Bearer SERVICE_TOKEN")
        return res.status(403).json({ error: "Forbidden" });

        const [rows] = await pool.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found" });
        res.json(rows[0]);
    });

    return router;
}