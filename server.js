// server.js - VERSIÓN COMPLETA CON HTML INTEGRADO
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// CORS configurado correctamente
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Ruta principal - servir el HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  console.log('✅ Health check recibido');
  res.json({ 
    status: 'OK', 
    message: 'Servidor de trading funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// API para obtener datos
app.get('/api/data', async (req, res) => {
  try {
    const { symbol, dateFrom, dateTo, interval } = req.query;
    
    if (!symbol || !dateFrom || !dateTo || !interval) {
      return res.status(400).json({ 
        error: 'Faltan parámetros: symbol, dateFrom, dateTo, interval' 
      });
    }
    
    console.log(`📊 Petición recibida: ${symbol} (${dateFrom} → ${dateTo}, ${interval})`);
    
    const period1 = Math.floor(new Date(dateFrom).getTime() / 1000);
    const period2 = Math.floor(new Date(dateTo).getTime() / 1000);
    
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}`;
    
    console.log('🔗 Llamando a Yahoo Finance...');
    const response = await fetch(yahooUrl);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.chart.result?.[0];
    
    if (!result) {
      return res.status(404).json({ 
        error: 'No se encontraron datos para este símbolo' 
      });
    }
    
    console.log(`✅ Datos obtenidos: ${result.timestamp.length} registros`);
    res.json(data);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  🚀 Servidor de Trading Sistemático          ║
║                                               ║
║  📡 Servidor: http://localhost:${PORT}        ║
║  🌐 Abrir en navegador:                      ║
║     → http://localhost:${PORT}                ║
║                                               ║
║  🔗 Endpoints disponibles:                   ║
║     → http://localhost:${PORT}/api/health     ║
║     → http://localhost:${PORT}/api/data       ║
╚═══════════════════════════════════════════════╝

✅ Servidor listo. Abre http://localhost:3000 en tu navegador
  `);
});