import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Usamos la librería que ya instalaste
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
// Esto sirve tu página web (index.html, styles.css, script.js)
app.use(express.static(__dirname));

// NUEVA RUTA: Tu propio proxy seguro
app.get('/api/yahoo', async (req, res) => {
  const { symbol, interval, period1, period2 } = req.query;
  
  // Construimos la URL de Yahoo
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}`;
  
  console.log(`📡 Pidiendo datos para: ${symbol}...`);

  try {
    const response = await fetch(yahooUrl);
    if (!response.ok) {
      throw new Error(`Yahoo Finance respondió con error: ${response.status}`);
    }
    const data = await response.json();
    res.json(data); // Enviamos los datos limpios a tu navegador
  } catch (err) {
    console.error("❌ Error en el servidor:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Servidor listo en: http://localhost:${port}`);
  console.log(`⚠️ IMPORTANTE: No abras el archivo index.html con doble clic.`);
  console.log(`⚠️ Abre tu navegador y escribe: http://localhost:${port}`);
});