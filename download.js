// download.js
import fs from 'node:fs';

// ========== CONFIGURACIÓN RÁPIDA ==========

// símbolo de Yahoo Finance, por ejemplo:
// BTC-USD (Bitcoin), ETH-USD, SPY, QQQ, etc.
const symbol = 'BTC-USD'; // cambia aquí

// rango de fechas (formato YYYY-MM-DD)
const dateFrom = '2025-10-01';  // desde
const dateTo   = '2026-01-01';  // hasta

// intervalo: 1d (diario), 1h, 1wk, 1mo, etc.
const interval = '1h';

// nombre del archivo de salida
const outputFile = `data_${symbol}_${interval}.csv`;

// ==========================================

async function main() {
  // si usas range, Yahoo ignora period1/period2;
  // aquí usaremos period1/period2 para control fino
  const period1 = Math.floor(new Date(dateFrom).getTime() / 1000);
  const period2 = Math.floor(new Date(dateTo).getTime() / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al pedir datos a Yahoo Finance`);
  }

  const data = await res.json();

  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error('Respuesta sin datos en result[0]');
  }

  const ts = result.timestamp;
  const quote = result.indicators.quote[0];
  const o = quote.open;
  const h = quote.high;
  const l = quote.low;
  const c = quote.close;
  const v = quote.volume;

  let csv = 'Date,Open,High,Low,Close,Volume\n';

  ts.forEach((t, i) => {
    if (o[i] == null || c[i] == null) return;
    const date = new Date(t * 1000).toISOString().slice(0, 10);
    csv += `${date},${o[i]},${h[i]},${l[i]},${c[i]},${v[i]}\n`;
  });

  fs.writeFileSync(outputFile, csv);
  console.log(`Archivo ${outputFile} creado`);
}

main().catch(err => {
  console.error('Error en main:', err);
});
