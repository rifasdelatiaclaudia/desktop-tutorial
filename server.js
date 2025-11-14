const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const axios = require("axios");
// --- Inicio: DB (pegar justo después de los require)
const { open } = require("sqlite");
const sqlite3 = require("sqlite3").verbose();

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
})();
// --- Fin: DB
const app = express();
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || "https://rifasdelatiaclaudia.onrender.com";

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// DB
const db = new sqlite3.Database("./rifa.db", (err) => {
  if (err) console.error("DB error:", err);
  else {
    console.log("DB conectado");
    db.run(`CREATE TABLE IF NOT EXISTS rifas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      numero INTEGER UNIQUE,
      pago_confirmado INTEGER DEFAULT 0,
      orden_flow TEXT,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Helper: obtener siguiente número libre (el más bajo)
function siguienteNumeroLibre(callback) {
  db.get("SELECT numero FROM rifas ORDER BY numero ASC LIMIT 1", [], (err, rowFirst) => {
    db.all("SELECT numero FROM rifas ORDER BY numero ASC", [], (err2, rows) => {
      if (err2) return callback(err2);
      const usados = rows.map(r => r.numero).filter(n => Number.isInteger(n)).sort((a,b)=>a-b);
      let esperado = 1;
      for (let n of usados) {
        if (n === esperado) esperado++;
        else if (n > esperado) break;
      }
      callback(null, esperado);
    });
  });
}

// Endpoint: iniciar pago -> reserva número + crear orden Flow
app.post("/iniciar-pago", async (req, res) => {
  try {
    const { nombre, telefono } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: "Faltan datos" });

    siguienteNumeroLibre((err, numeroLibre) => {
      if (err) return res.status(500).json({ error: "DB error" });

      const insert = `INSERT INTO rifas (nombre, telefono, numero, pago_confirmado) VALUES (?, ?, ?, 0)`;
      db.run(insert, [nombre, telefono, numeroLibre], function(err){
        if (err) {
          console.error("Insert error:", err);
          return res.status(500).json({ error: "No se pudo crear la reserva" });
        }

        const reservaId = this.lastID;
        const commerceOrder = `RIFA-${reservaId}-${Date.now()}`;

        const payload = {
          apiKey: process.env.FLOW_API_KEY,
          commerceOrder,
          subject: `Compra rifa - número ${numeroLibre}`,
          currency: "CLP",
          amount: 3000,
          email: "",
          urlConfirmation: `${BASE_URL}/flow-confirm`,
          urlReturn: `${BASE_URL}/flow-return?reserva=${reservaId}`
        };

        axios.post("https://www.flow.cl/api/payment/create", payload)
          .then(response => {
            const flowUrl = response.data.url || response.data.payment_url || response.data.redirect_url || null;
            const update = `UPDATE rifas SET orden_flow = ? WHERE id = ?`;
            db.run(update, [commerceOrder, reservaId], (errUpd) => {
              if (errUpd) console.error("update orden_flow err:", errUpd);
              return res.json({ url: flowUrl, reservaId, numeroReservado: numeroLibre });
            });
          })
          .catch(errFlow => {
            console.error("Flow error:", errFlow.response?.data || errFlow.message);
            db.run("DELETE FROM rifas WHERE id = ?", [reservaId], ()=>{});
            return res.status(500).json({ error: "Error creando orden de pago" });
          });
      });
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error interno" });
  }
});

// Endpoint que Flow llamará para confirmar (webhook)
app.post("/flow-confirm", (req, res) => {
  const body = req.body || {};
  const commerceOrder = body.commerceOrder || body.order || null;
  const status = body.status || body.state || null;

  if (!commerceOrder) {
    return res.status(400).send("no data");
  }

  db.run("UPDATE rifas SET pago_confirmado = 1 WHERE orden_flow = ?", [commerceOrder], function(err){
    if (err) {
      console.error("Error marcando pago:", err);
      return res.status(500).send("error");
    }
    res.send("ok");
  });
});

// Endpoint de retorno donde Flow redirige al usuario tras pagar
app.get("/flow-return", (req, res) => {
  const reservaId = req.query.reserva;
  if (!reservaId) return res.send("Reserva no identificada");

  db.get("SELECT * FROM rifas WHERE id = ?", [reservaId], (err, row) => {
    if (err || !row) return res.send("Reserva no encontrada");
    if (row.pago_confirmado == 1) {
      return res.send(`<h1>Pago confirmado</h1><p>Tu número es: <b>#${row.numero}</b></p>`);
    } else {
      return res.send(`<h1>Pago pendiente</h1><p>Si completaste el pago en minutos se confirmará automáticamente.</p>`);
    }
  });
});

// Endpoint para listar todas las rifas
app.get("/rifas", (req, res) => {
  db.all("SELECT * FROM rifas ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
const axios = require("axios");

// helper: siguiente número libre (más bajo)
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

// 1) iniciar pago: crea reserva y orden en Flow
app.post("/iniciar-pago", express.json(), async (req, res) => {
  try {
    const { nombre, correo = "", telefono = "", instagram = "" } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: "Faltan datos" });

    const result = await db.run(
      "INSERT INTO participantes (nombre, correo, telefono, instagram, pagado) VALUES (?, ?, ?, ?, 0)",
      [nombre, correo, telefono, instagram]
    );
    const reservaId = result.lastID;
    const commerceOrder = `RIFA-${reservaId}-${Date.now()}`;

    const payload = {
      apiKey: process.env.FLOW_API_KEY,
      commerceOrder,
      subject: `Rifa - reserva ${reservaId}`,
      currency: "CLP",
      amount: 3000,
      email: correo,
      urlConfirmation: `${process.env.BASE_URL}/flow-confirm`,
      urlReturn: `${process.env.BASE_URL}/flow-return?reserva=${reservaId}`
    };

    const flowRes = await axios.post("https://www.flow.cl/api/payment/create", payload, {
      headers: { "Content-Type": "application/json" }
    });

    const flowUrl = flowRes.data.url || flowRes.data.payment_url || flowRes.data.redirect_url;
    await db.run("UPDATE participantes SET orden_flow = ? WHERE id = ?", [commerceOrder, reservaId]);

    return res.json({ url: flowUrl, reservaId });
  } catch (err) {
    console.error("Error /iniciar-pago:", err.response?.data || err.message || err);
    return res.status(500).json({ error: "No se pudo iniciar el pago" });
  }
});

// 2) webhook que Flow llama al confirmar (configurar en Flow panel)
app.post("/flow-confirm", express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const commerceOrder = body.commerceOrder || body.order || body.commerce_order;
    if (!commerceOrder) return res.status(400).send("missing commerceOrder");

    const row = await db.get("SELECT * FROM participantes WHERE orden_flow = ?", [commerceOrder]);
    if (!row) return res.status(404).send("not found");
    if (row.pagado === 1) return res.status(200).send("already processed");

    const numeroASIG = await siguienteNumeroLibre();
    await db.run("UPDATE participantes SET numero = ?, pagado = 1 WHERE id = ?", [numeroASIG, row.id]);

    console.log(`Pago confirmado para reserva ${row.id} -> numero ${numeroASIG}`);
    res.status(200).send("ok");
  } catch (err) {
    console.error("Error /flow-confirm:", err);
    res.status(500).send("error");
  }
});

// 3) return url donde Flow manda al usuario después de pagar
app.get("/flow-return", async (req, res) => {
  const reservaId = req.query.reserva;
  if (!reservaId) return res.send("Reserva no identificada");
  const row = await db.get("SELECT * FROM participantes WHERE id = ?", [reservaId]);
  if (!row) return res.send("Reserva no encontrada");
  if (row.pagado === 1 && row.numero) {
    return res.send(`<h1>Pago confirmado ✅</h1><p>Tu número asignado es: <b>#${row.numero}</b></p>`);
  } else {
    return res.send(`<h1>Pago en proceso</h1><p>Si completaste el pago, espera unos segundos. <script>setTimeout(()=>location.reload(),4000)</script></p>`);
  }
});
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
