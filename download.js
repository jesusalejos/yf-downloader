import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ========== CONFIGURACIÓN ==========
const CONFIG = {
  symbol: 'BTC-USD',   // Cambia esto por el activo que quieras (ej: ETH-USD, SPY)
  dateFrom: '2024-01-01',
  dateTo: new Date().toISOString().split('T')[0], // Hasta el día de hoy
  interval: '1d'       // '1d', '1h', '1wk'
};
// ===================================

export async function main() {
  console.log(`\n🚀 INICIANDO ANÁLISIS DE TERMINAL PARA: ${CONFIG.symbol}`);
  console.log(`📅 Rango: ${CONFIG.dateFrom} a ${CONFIG.dateTo} (${CONFIG.interval})`);
  console.log('---------------------------------------------------');

  try {
    // 1. CONEXIÓN DIRECTA (Backend Node.js)
    const period1 = Math.floor(new Date(CONFIG.dateFrom).getTime() / 1000);
    const period2 = Math.floor(new Date(CONFIG.dateTo).getTime() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${CONFIG.symbol}?interval=${CONFIG.interval}&period1=${period1}&period2=${period2}`;
    
    console.log('📡 Descargando datos crudos de Yahoo Finance...');
    const res = await fetch(url);
    
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);

    const data = await res.json();
    const result = data.chart.result?.[0];
    
    if (!result) throw new Error('Yahoo no devolvió datos. Revisa el símbolo o las fechas.');

    // 2. PROCESAMIENTO Y LIMPIEZA
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;
    
    const cleanData = timestamps.map((t, i) => ({
      date: new Date(t * 1000).toISOString().split('T')[0],
      close: quotes.close[i],
      open: quotes.open[i],
      high: quotes.high[i],
      low: quotes.low[i],
      volume: quotes.volume[i]
    })).filter(day => day.close != null);

    console.log(`✅ ${cleanData.length} velas procesadas correctamente.`);

    // 3. CÁLCULOS ESTADÍSTICOS (Lógica compartida con la web)
    const returns = [];
    for (let i = 1; i < cleanData.length; i++) {
      const current = cleanData[i].close;
      const prev = cleanData[i-1].close;
      const ret = (current - prev) / prev;
      
      returns.push({
        date: cleanData[i].date,
        value: ret,
        percent: (ret * 100).toFixed(2) + '%'
      });
    }

    const values = returns.map(r => r.value);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    
    // Mediana
    const sortedValues = [...values].sort((a,b) => a-b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];

    // Volatilidad
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 4. REPORTE EN TERMINAL
    console.log('\n📊 --- RESULTADOS DEL ANÁLISIS ---');
    console.log(`📈 Rendimiento Promedio: ${(avg * 100).toFixed(4)}%`);
    console.log(`🎯 Mediana:              ${(median * 100).toFixed(4)}%`);
    console.log(`⚡ Volatilidad (Riesgo): ${(stdDev * 100).toFixed(4)}%`);
    
    // Top 5 Mejores (Color Verde en terminal: \x1b[32m)
    const best5 = [...returns].sort((a,b) => b.value - a.value).slice(0, 5);
    console.log('\n🚀 TOP 5 MEJORES DÍAS:');
    best5.forEach(d => console.log(`   ${d.date}: \x1b[32m${d.percent}\x1b[0m`));

    // Top 5 Peores (Color Rojo en terminal: \x1b[31m)
    const worst5 = [...returns].sort((a,b) => a.value - b.value).slice(0, 5);
    console.log('\n💀 TOP 5 PEORES DÍAS:');
    worst5.forEach(d => console.log(`   ${d.date}: \x1b[31m${d.percent}\x1b[0m`));

    // 5. GUARDAR CSV
    const fileName = `${CONFIG.symbol}_${CONFIG.interval}.csv`;
    let csvContent = 'Date,Open,High,Low,Close,Volume,Return\n';
    
    cleanData.forEach((d, i) => {
        const retVal = i > 0 ? ((d.close - cleanData[i-1].close)/cleanData[i-1].close).toFixed(6) : 0;
        csvContent += `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume},${retVal}\n`;
    });

    fs.writeFileSync(fileName, csvContent);
    console.log(`\n💾 Archivo CSV guardado: ${fileName}`);
    console.log('---------------------------------------------------');

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
  }
}

// Ejecutar automáticamente si se llama desde la terminal
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}