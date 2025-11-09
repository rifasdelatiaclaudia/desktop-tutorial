
Rifa App - Gran Rifa La Tía Claudia
===================================

Descripción:
- Web app local (Node + Express + SQLite) para gestionar la rifa.
- Permite a usuarios elegir número, subir comprobante y (opcional) abrir WhatsApp para enviar comprobante.
- Admin con contraseña puede descargar CSV con las ventas.

Instalación (en tu PC):
1) Instala Node.js (versión 16+ recomendada) desde https://nodejs.org
2) Abre terminal en la carpeta del proyecto
3) Ejecuta: npm install
4) Ejecuta: npm start
5) Abre tu navegador en: http://localhost:3000

Credenciales admin (simple):
- Contraseña admin: claudia2025
- Endpoints admin:
  - /admin/list?pass=claudia2025  -> devuelve JSON con ventas
  - /admin/export?pass=claudia2025 -> descarga CSV con ventas

Archivo generado:
- RifaApp.zip (contiene todo el proyecto)

Notas y recomendaciones:
- La app guarda archivos subidos en la carpeta /uploads.
- Haz backup de la base de datos 'rifa.db' si la mueves a otro servidor.
- Para publicar en la web (vercel, render, heroku) deberás subir el proyecto y ajustar variables.

