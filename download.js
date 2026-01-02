// download.js - Script de terminal independiente
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ========== CONFIGURACIÓN RÁPIDA ==========

const symbol = 'BTC-USD';
const dateFrom = '2024-01-01';
const dateTo = '2026-01-01';
const interval = '1d';
const outputFile = `data_${symbol}_${interval}.csv`;

// ==========================================

export async function main() {
  console.log(`📥 Descargando datos de ${symbol}...`);
  
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
  console.log(`✅ Archivo ${outputFile} creado con éxito`);
  console.log(`📊 Total de registros: ${ts.length}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  });
}