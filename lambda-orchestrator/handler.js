import axios from "axios";
import dotenv from "dotenv";
dotenv.config(); // Solo para local

const CUSTOMERS_API_BASE = process.env.CUSTOMERS_API_BASE;
const ORDERS_API_BASE = process.env.ORDERS_API_BASE;

export const orchestrator = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { customerId, orderId } = body;

    // 1️⃣ Llamar a Customers API
    const customerResponse = await axios.get(`${CUSTOMERS_API_BASE}/customers/${customerId}`);
    
    // 2️⃣ Llamar a Orders API
    const orderResponse = await axios.get(`${ORDERS_API_BASE}/orders/${orderId}`);

    // 3️⃣ Combinar resultados
    const result = {
      customer: customerResponse.data,
      order: orderResponse.data
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};