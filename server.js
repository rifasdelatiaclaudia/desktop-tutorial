const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer config
const storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function(req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random()*1E9);
    cb(null, unique + '-' + file.originalname.replace(/\\s+/g,'_'));
  }
});
const upload = multer({ storage: storage });

// SQLite DB
const dbFile = path.join(__dirname, 'rifa.db');
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT,
    nombre TEXT,
    telefono TEXT,
    email TEXT,
    comprobante TEXT,
    metodo_whatsapp INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// API: check number availability
app.get('/api/numero/:n', (req,res)=>{
  const raw = req.params.n;
  const n = String(parseInt(raw)).padStart(5,'0');
  db.get("SELECT * FROM ventas WHERE numero = ?", [n], (err,row)=>{
    if(err) return res.status(500).json({error:err.message});
    if(row) res.json({numero:n, disponible:false, venta:row});
    else res.json({numero:n, disponible:true});
  });
});

// API: comprar/registrar número con upload
app.post('/api/comprar', upload.single('comprobante'), (req,res)=>{
  const { numero, nombre, telefono, email, metodo_whatsapp } = req.body;
  if(!numero || !nombre || !telefono) return res.status(400).json({error:'Faltan datos'});
  const num = String(numero).padStart(5,'0');
  // check availability
  db.get("SELECT * FROM ventas WHERE numero = ?", [num], (err,row)=>{
    if(err) return res.status(500).json({error:err.message});
    if(row) return res.status(400).json({error:'Número ya vendido'});
    const comprobante = req.file ? '/uploads/' + path.basename(req.file.path) : '';
    db.run(`INSERT INTO ventas (numero,nombre,telefono,email,comprobante,metodo_whatsapp,estado) VALUES (?,?,?,?,?,?,?)`,
      [num,nombre,telefono,email,comprobante, metodo_whatsapp ? 1 : 0, 'pagado'], function(err){
        if(err) return res.status(500).json({error:err.message});
        res.json({ok:true, id:this.lastID, numero:num});
      });
  });
});

// Admin: list ventas (simple password)
const ADMIN_PASS = 'claudia2025';
app.get('/admin/list', (req,res)=>{
  const pass = req.query.pass || '';
  if(pass !== ADMIN_PASS) return res.status(401).json({error:'Unauthorized'});
  db.all("SELECT * FROM ventas ORDER BY id DESC", (err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// Admin: download CSV
app.get('/admin/export', (req,res)=>{
  const pass = req.query.pass || '';
  if(pass !== ADMIN_PASS) return res.status(401).json({error:'Unauthorized'});
  db.all("SELECT * FROM ventas ORDER BY id ASC", (err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    const header = 'id,numero,nombre,telefono,email,comprobante,metodo_whatsapp,estado,created_at\n';
    const lines = rows.map(r=> `${r.id},${r.numero},"${r.nombre}",${r.telefono},"${r.email}","${r.comprobante}",${r.metodo_whatsapp},${r.estado},${r.created_at}`);
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="ventas_rifa.csv"');
    res.send(header + lines.join('\\n'));
  });
});

// Fallback
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server started on port',PORT));
