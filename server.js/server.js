const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Base de datos
const db = new sqlite3.Database("./rifa.db", (err) => {
  if (err) console.error("Error al conectar la base de datos:", err);
  else console.log("Conectado a la base de datos SQLite");
});

// Configuración de subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Rutas
app.get("/", (req, res) => {
  res.send("✅ Servidor de Rifas de la Tía Claudia funcionando correctamente!");
});

// Ejemplo de subida de archivo
app.post("/subir", upload.single("imagen"), (req, res) => {
  res.json({ msg: "Archivo subido correctamente", file: req.file });
});

// Ejemplo de consulta a la base de datos
app.get("/rifas", (req, res) => {
  db.all("SELECT * FROM rifas", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));