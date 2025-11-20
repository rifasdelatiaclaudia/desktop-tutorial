// ------------------ DEPENDENCIAS ------------------
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

// ------------------ VARIABLES ------------------
const app = express();
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || "https://rifasdelatiaclaudia.onrender.com";
const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;

// ------------------ MIDDLEWARE ------------------
app.use(cors());
app.use(bodyParser.json());
app.use(express.json()); // necesario para webhook
app.use(express.static("public"));

// ------------------ BASE DE DATOS ------------------
let db;

(async () => {
  db = await open({
    filename: "./rifa.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS participantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      correo TEXT,
      telefono TEXT,
      instagram TEXT,
      numero INTEGER UNIQUE,
      orden_flow TEXT,
      pagado INTEGER DEFAULT 0,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("DB lista");
})();

// ------------------ FUNCION: SIGUIENTE NÚMERO LIBRE ------------------
async function siguienteNumeroLibre() {
  const rows = await db.all("SELECT numero FROM participantes WHERE numero IS NOT NULL ORDER BY numero ASC");
  const usados = rows.map(r => r.numero);
  let esperado = 1;
  for (let n of usados) {
    if (n === esperado) esperado++;
    else if (n > esperado) break;
  }
  return esperado;
}

// ------------------ FIRMAR FLOW ------------------
function firmarParametros(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHmac("sha256", FLOW_SECRET_KEY).update(sorted).digest("hex");
}

// ------------------ 1) INICIAR PAGO ------------------
app.post("/iniciar-pago", async (req, res) => {
  try {
    const { nombre, correo = "", telefono = "", instagram = "" } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: "Faltan datos" });

    const result = await db.run(
      "INSERT INTO participantes (nombre, correo, telefono, instagram, pagado) VALUES (?, ?, ?, ?, 0)",
      [nombre, correo, telefono, instagram]
    );
    const reservaId = result.lastID;
    const commerceOrder = `RIFA-${reservaId}-${Date.now()}`;

    const params = {
      apiKey: FLOW_API_KEY,
      commerceOrder,
      subject: `Rifa #${reservaId}`,
      currency: "CLP",
      amount: 3000,
      email: correo,
      urlReturn: `${BASE_URL}/flow-return?reserva=${reservaId}`,
      urlConfirmation: `${BASE_URL}/flow-confirm`
    };

    params.s = firmarParametros(params);

    const flowRes = await axios.post("https://www.flow.cl/api/payment/create", params, {
      headers: { "Content-Type": "application/json" }
    });

    const flowUrl = flowRes.data.url || flowRes.data.payment_url || flowRes.data.redirect_url;
    await db.run("UPDATE participantes SET orden_flow = ? WHERE id = ?", [commerceOrder, reservaId]);

    return res.json({ url: flowUrl, reservaId });
  } catch (err) {
    console.error("Error /iniciar-pago:", err.response?.data || err);
    return res.status(500).json({ error: "No se pudo iniciar pago" });
  }
});

// ------------------ 2) WEBHOOK: Flow confirma el pago ------------------
app.post("/flow-confirm", async (req, res) => {
  try {
    const commerceOrder = req.body.commerceOrder || req.body.order || req.body.commerce_order;
    if (!commerceOrder) return res.status(400).send("missing commerceOrder");

    const row = await db.get("SELECT * FROM participantes WHERE orden_flow = ?", [commerceOrder]);
    if (!row) return res.status(404).send("not found");
    if (row.pagado === 1) return res.status(200).send("already processed");

    const num = await siguienteNumeroLibre();
    await db.run("UPDATE participantes SET numero = ?, pagado = 1 WHERE id = ?", [num, row.id]);

    console.log(`Pago confirmado -> Reserva ${row.id} asignado #${num}`);
    return res.status(200).send("ok");
  } catch (err) {
    console.error("Error /flow-confirm:", err);
    return res.status(500).send("error");
  }
});

// ------------------ 3) RETURN: usuario vuelve de Flow ------------------
app.get("/flow-return", async (req, res) => {
  const reservaId = req.query.reserva;
  if (!reservaId) return res.send("Reserva no identificada");

  const row = await db.get("SELECT * FROM participantes WHERE id = ?", [reservaId]);
  if (!row) return res.send("Reserva no encontrada");

  if (row.pagado === 1 && row.numero) {
    return res.send(`<h1>Pago confirmado</h1><p>Tu número asignado es: <b>#${row.numero}</b></p>`);
  } else {
    return res.send(`<h1>Pago en proceso</h1><p>Si pagaste, espera unos segundos y recarga esta página.</p>`);
  }
});

// ------------------ INICIAR SERVIDOR ------------------
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});