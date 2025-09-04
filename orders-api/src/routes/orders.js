import { Router } from "express";
import { z } from "zod";
import axios from "axios";

export default function(pool) {
  const router = Router();

  // ----------------- Productos -----------------

  // Crear producto
  router.post("/products", async (req, res) => {
    const schema = z.object({
      sku: z.string(),
      name: z.string(),
      price_cents: z.number().int(),
      stock: z.number().int()
    });

    try {
      const { sku, name, price_cents, stock } = schema.parse(req.body);
      const [result] = await pool.query(
        "INSERT INTO products (sku, name, price_cents, stock, created_at) VALUES (?, ?, ?, ?, NOW())",
        [sku, name, price_cents, stock]
      );
      res.status(201).json({ id: result.insertId, sku, name, price_cents, stock });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Actualizar producto (precio/stock)
  router.patch("/products/:id", async (req, res) => {
    const { price_cents, stock } = req.body;
    await pool.query(
      "UPDATE products SET price_cents=?, stock=? WHERE id=?",
      [price_cents, stock, req.params.id]
    );
    res.json({ id: req.params.id, price_cents, stock });
  });

  // Detalle producto
  router.get("/products/:id", async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM products WHERE id=?", [
      req.params.id
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  // Listar productos con búsqueda
  router.get("/products", async (req, res) => {
    const { search = "", cursor = 0, limit = 10 } = req.query;
    const [rows] = await pool.query(
      "SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? LIMIT ? OFFSET ?",
      [`%${search}%`, `%${search}%`, Number(limit), Number(cursor)]
    );
    res.json(rows);
  });

  // ----------------- Órdenes -----------------

  // Crear orden
  router.post("/orders", async (req, res) => {
    const schema = z.object({
      customer_id: z.number().int(),
      items: z.array(z.object({ product_id: z.number().int(), qty: z.number().int().min(1) }))
    });

    try {
      const { customer_id, items } = schema.parse(req.body);

      // validar cliente en Customers API
      await axios.get(`${process.env.CUSTOMERS_API_BASE}/internal/customers/${customer_id}`, {
        headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` }
      });

      // iniciar transacción
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        let total = 0;
        for (const item of items) {
          const [[product]] = await conn.query("SELECT * FROM products WHERE id=?", [item.product_id]);
          if (!product || product.stock < item.qty) throw new Error("Stock insuficiente");
          const subtotal = product.price_cents * item.qty;
          total += subtotal;

          await conn.query("UPDATE products SET stock=stock-? WHERE id=?", [item.qty, item.product_id]);
        }

        const [orderResult] = await conn.query(
          "INSERT INTO orders (customer_id, status, total_cents, created_at) VALUES (?, 'CREATED', ?, NOW())",
          [customer_id, total]
        );
        const orderId = orderResult.insertId;

        for (const item of items) {
          const [[product]] = await conn.query("SELECT * FROM products WHERE id=?", [item.product_id]);
          await conn.query(
            "INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)",
            [orderId, item.product_id, item.qty, product.price_cents, product.price_cents * item.qty]
          );
        }

        await conn.commit();
        res.status(201).json({ id: orderId, status: "CREATED", total_cents: total });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Detalle de orden con items
  router.get("/orders/:id", async (req, res) => {
    const [[order]] = await pool.query("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!order) return res.status(404).json({ error: "Not found" });

    const [items] = await pool.query("SELECT * FROM order_items WHERE order_id=?", [req.params.id]);
    res.json({ ...order, items });
  });

  // Listar órdenes con filtros
  router.get("/orders", async (req, res) => {
    const { status, from, to, cursor = 0, limit = 10 } = req.query;
    let query = "SELECT * FROM orders WHERE 1=1";
    const params = [];

    if (status) { query += " AND status=?"; params.push(status); }
    if (from) { query += " AND created_at >= ?"; params.push(from); }
    if (to) { query += " AND created_at <= ?"; params.push(to); }

    query += " LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(cursor));

    const [rows] = await pool.query(query, params);
    res.json(rows);
  });

  // Confirmar orden (idempotente)
  router.post("/orders/:id/confirm", async (req, res) => {
    const key = req.headers["x-idempotency-key"];
    if (!key) return res.status(400).json({ error: "Missing idempotency key" });

    // verificar si ya existe
    const [exists] = await pool.query("SELECT * FROM idempotency_keys WHERE `key`=?", [key]);
    if (exists.length > 0) {
      return res.json(JSON.parse(exists[0].response_body));
    }

    const [[order]] = await pool.query("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!order) return res.status(404).json({ error: "Not found" });

    if (order.status !== "CREATED") return res.json(order);

    await pool.query("UPDATE orders SET status='CONFIRMED' WHERE id=?", [req.params.id]);
    const [[confirmed]] = await pool.query("SELECT * FROM orders WHERE id=?", [req.params.id]);

    await pool.query(
      "INSERT INTO idempotency_keys (`key`, target_type, target_id, status, response_body, created_at) VALUES (?, 'order', ?, 'CONFIRMED', ?, NOW())",
      [key, req.params.id, JSON.stringify(confirmed)]
    );

    res.json(confirmed);
  });

  // Cancelar orden
  router.post("/orders/:id/cancel", async (req, res) => {
    const [[order]] = await pool.query("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!order) return res.status(404).json({ error: "Not found" });

    if (order.status === "CREATED") {
      await pool.query("UPDATE orders SET status='CANCELED' WHERE id=?", [req.params.id]);
      res.json({ id: req.params.id, status: "CANCELED" });
    } else if (order.status === "CONFIRMED") {
      const diff = (Date.now() - new Date(order.created_at).getTime()) / 60000;
      if (diff <= 10) {
        await pool.query("UPDATE orders SET status='CANCELED' WHERE id=?", [req.params.id]);
        res.json({ id: req.params.id, status: "CANCELED" });
      } else {
        res.status(400).json({ error: "Cancelation window expired" });
      }
    } else {
      res.status(400).json({ error: "Invalid status" });
    }
  });

  return router;
}
