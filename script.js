// Variables globales
let chartInstance = null;
let currentData = null;

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('dateTo').valueAsDate = new Date();
  updateIntervalNote();
});

function setSymbol(symbol) {
  document.getElementById('symbol').value = symbol;
}

function updateIntervalNote() {
  const interval = document.getElementById('interval').value;
  const note = document.getElementById('intervalNote');
  
  const notes = {
    '1m': '⚠️ Solo últimos 7 días disponibles',
    '2m': '⚠️ Solo últimos 60 días disponibles',
    '5m': '⚠️ Solo últimos 60 días disponibles',
    '1h': '💡 Ideal para análisis de 1-2 meses',
    '1d': '💡 Ideal para análisis de 2+ años',
    '1wk': '💡 Ideal para análisis de largo plazo'
  };
  
  note.textContent = notes[interval] || '💡 Selecciona según tu estrategia';
}

/**
 * FUNCIÓN CENTRAL: Solo obtiene y limpia los datos
 * Retorna 'rows' si todo sale bien, o null si falla.
 */
async function fetchDataShared(sourceButtonId) {
  const symbol = document.getElementById('symbol').value.trim();
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;
  const interval = document.getElementById('interval').value;
  
  // Validaciones
  if (!symbol || !dateFrom || !dateTo) {
    showMessage('Por favor completa todos los campos', 'error');
    return null;
  }

  const daysDiff = Math.floor((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
  if ((interval === '1m' && daysDiff > 7) || (['2m', '5m', '15m'].includes(interval) && daysDiff > 60)) {
    showMessage(`⚠️ Intervalo ${interval} limitado. Reduce el rango de fechas si falla.`, 'warning');
  }

  // UI Loading
  const loading = document.getElementById('loading');
  const btn = document.getElementById(sourceButtonId);
  const originalText = btn.innerText;
  
  loading.classList.add('active');
  btn.disabled = true;
  btn.innerText = "⏳ Cargando...";
  document.getElementById('message').innerHTML = '';

  try {
    const period1 = Math.floor(new Date(dateFrom).getTime() / 1000);
    const period2 = Math.floor(new Date(dateTo).getTime() / 1000);
    
    // Usamos el Proxy Público (Compatible con GitHub Pages)
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;
    
    console.log('📡 Buscando datos...');
    const response = await fetch(proxyUrl);
    
    if (!response.ok) throw new Error(`Error conexión (${response.status})`);
    
    const data = await response.json();
    const result = data.chart.result?.[0];
    
    if (!result) throw new Error('Yahoo no devolvió datos. Verifica el símbolo o fechas.');
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    
    const rows = timestamps.map((t, i) => {
      if (quote.open[i] == null || quote.close[i] == null) return null;
      
      const date = new Date(t * 1000);
      let dateStr;
      
      if (['1m', '2m', '5m', '15m', '30m', '1h', '90m'].includes(interval)) {
        dateStr = date.toISOString().slice(0, 16).replace('T', ' ');
      } else {
        dateStr = date.toISOString().split('T')[0];
      }
      
      return {
        date: dateStr,
        timestamp: t,
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i]
      };
    }).filter(row => row !== null);
    
    if (rows.length === 0) throw new Error('No se encontraron datos válidos en este rango.');

    currentData = rows;
    return rows;

  } catch (error) {
    showMessage(`❌ Error: ${error.message}`, 'error');
    console.error(error);
    return null;
  } finally {
    loading.classList.remove('active');
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

/**
 * ACCIÓN 1: Solo Visualizar
 */
async function handleVisualize() {
  const rows = await fetchDataShared('btnVisualize');
  if (rows) {
    showMessage(`✅ ${rows.length} datos cargados. Visualización actualizada.`, 'success');
    renderStats(rows);
    renderChart(rows, document.getElementById('symbol').value, document.getElementById('interval').value);
    renderTable(rows);
    
    // Aseguramos que los paneles sean visibles
    document.getElementById('statsPanel').style.display = 'block';
    document.getElementById('chartPanel').style.display = 'block';
    document.getElementById('tablePanel').style.display = 'block';
  }
}

/**
 * ACCIÓN 2: Solo Descargar
 */
async function handleDownload() {
  // Si ya tenemos datos en memoria (de una visualización previa), ¿para qué gastar internet?
  // Pero si el usuario cambió las fechas, debemos recargar. 
  // Para seguridad y simplicidad, siempre recargamos los datos frescos de la API.
  const rows = await fetchDataShared('btnDownload');
  if (rows) {
    downloadCSV(rows, document.getElementById('symbol').value, document.getElementById('interval').value);
    showMessage(`✅ Archivo CSV descargado (${rows.length} registros).`, 'success');
  }
}

function showMessage(text, type) {
  document.getElementById('message').innerHTML = 
    `<div class="alert ${type === 'success' ? 'success' : type === 'warning' ? 'warning' : ''}">${text}</div>`;
}

// --- FUNCIONES DE RENDERIZADO (Iguales que antes) ---

function renderStats(rows) {
  const dailyReturns = []; 
  const closes = rows.map(r => r.close);
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayStats = {};

  for (let i = 1; i < rows.length; i++) {
    const ret = (rows[i].close - rows[i-1].close) / rows[i-1].close;
    const dateObj = new Date(rows[i].timestamp * 1000);
    
    dailyReturns.push({ date: rows[i].date, value: ret });
    
    const dayIndex = dateObj.getDay();
    if (!dayStats[dayIndex]) dayStats[dayIndex] = [];
    dayStats[dayIndex].push(ret);
  }

  const values = dailyReturns.map(x => x.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  const variance = values.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];

  const best5 = [...dailyReturns].sort((a, b) => b.value - a.value).slice(0, 5);
  const worst5 = [...dailyReturns].sort((a, b) => a.value - b.value).slice(0, 5);

  let dayAnalysisHTML = '<div class="stat-card full-width"><h3>📅 Patrones Semanales</h3><div class="days-grid">';
  [1, 2, 3, 4, 5].forEach(dayIdx => {
    const dRet = dayStats[dayIdx] || [];
    if (dRet.length > 0) {
      const avgD = dRet.reduce((a,b)=>a+b,0) / dRet.length;
      dayAnalysisHTML += `<div class="day-stat"><span class="day-name">${dayNames[dayIdx]}</span><span class="day-value ${avgD >= 0 ? 'text-green' : 'text-red'}">${(avgD * 100).toFixed(2)}%</span></div>`;
    } else {
      dayAnalysisHTML += `<div class="day-stat"><span class="day-name">${dayNames[dayIdx]}</span><span class="day-value">-</span></div>`;
    }
  });
  dayAnalysisHTML += '</div></div>';

  const rowGen = (l) => l.map(i => `<tr><td>${i.date.split(' ')[0]}</td><td style="color:${i.value>=0?'#4ade80':'#f87171'}">${(i.value*100).toFixed(2)}%</td></tr>`).join('');

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value ${totalReturn<0?'negative':''}">${(totalReturn*100).toFixed(2)}%</div></div>
    <div class="stat-card"><div class="stat-label">Promedio</div><div class="stat-value ${avg<0?'negative':''}">${(avg*100).toFixed(3)}%</div></div>
    <div class="stat-card"><div class="stat-label">Mediana</div><div class="stat-value">${(median*100).toFixed(3)}%</div></div>
    <div class="stat-card"><div class="stat-label">Volatilidad</div><div class="stat-value" style="color:#fbbf24">${(stdDev*100).toFixed(3)}%</div></div>
    ${dayAnalysisHTML}
    <div class="stat-card wide"><div class="stat-label">🚀 Mejores</div><table>${rowGen(best5)}</table></div>
    <div class="stat-card wide"><div class="stat-label">💀 Peores</div><table>${rowGen(worst5)}</table></div>
  `;
}

function renderChart(rows, symbol, interval) {
  const ctx = document.getElementById('priceChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.date),
      datasets: [{
        label: `${symbol} (${interval})`,
        data: rows.map(r => r.close),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 10, color: '#9ca3af' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: '#334155' } }
      }
    }
  });
}

function renderTable(rows) {
  document.getElementById('rowCount').textContent = rows.length;
  let html = '<table><thead><tr><th>Fecha</th><th>Cierre</th><th>Vol</th></tr></thead><tbody>';
  rows.slice().reverse().slice(0, 50).forEach(r => {
    html += `<tr><td>${r.date}</td><td>$${r.close.toFixed(2)}</td><td>${r.volume.toLocaleString()}</td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('tableContainer').innerHTML = html;
}

function downloadCSV(rows, symbol, interval) {
  let csv = 'DateTime,Open,High,Low,Close,Volume\n';
  rows.forEach(r => csv += `${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}\n`);
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_${interval}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}