// server.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; 
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Servir los archivos estáticos (HTML, JS, CSS) del Frontend
app.use(express.static(__dirname));

// RUTA API PROPIA (Tu proxy privado)
app.get('/api/yahoo', async (req, res) => {
  const { symbol, interval, period1, period2 } = req.query;
  
  // URL directa a Yahoo (Tu servidor no tiene CORS, así que puede pedirla directo)
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}`;
  
  console.log(`📡 Backend solicitando: ${symbol}...`);

  try {
    const response = await fetch(yahooUrl);
    if (!response.ok) throw new Error(`Yahoo Error: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Error Backend:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Manejar cualquier otra ruta devolviendo el index.html (para SPAs)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor Profesional corriendo en: http://localhost:${port}`);
});