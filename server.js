const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const db = new sqlite3.Database("./rifa.db", (err) => {
  if (err) console.error("❌ Error al conectar la base de datos:", err);
  else console.log("✅ Conectado a la base de datos SQLite");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint para asignar número aleatorio
app.post("/comprar", (req, res) => {
  const numero = Math.floor(Math.random() * 100000) + 1;
  res.json({ numero });
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));