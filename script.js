// Variables globales
let chartInstance = null;
let currentData = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('dateTo').valueAsDate = new Date();
  updateIntervalNote();
});

/**
 * Establece el símbolo del activo
 */
function setSymbol(symbol) {
  document.getElementById('symbol').value = symbol;
}

/**
 * Actualiza la nota de intervalo según el timeframe seleccionado
 */
function updateIntervalNote() {
  const interval = document.getElementById('interval').value;
  const note = document.getElementById('intervalNote');
  
  const notes = {
    '1m': '⚠️ Solo últimos 7 días disponibles',
    '2m': '⚠️ Solo últimos 60 días disponibles',
    '5m': '⚠️ Solo últimos 60 días disponibles',
    '15m': '💡 Ideal para swing trading intradiario',
    '30m': '💡 Ideal para análisis de horas',
    '1h': '💡 Ideal para análisis de 1-2 meses',
    '90m': '💡 Análisis de medio día',
    '1d': '💡 Ideal para análisis de 2+ años',
    '5d': '💡 Vista semanal simplificada',
    '1wk': '💡 Ideal para análisis de largo plazo',
    '1mo': '💡 Vista mensual, varios años',
    '3mo': '💡 Vista trimestral'
  };
  
  note.textContent = notes[interval] || '💡 Selecciona según tu estrategia';
}

/**
 * Descarga datos de Yahoo Finance y realiza el análisis
 */
async function downloadData() {
  const symbol = document.getElementById('symbol').value.trim();
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;
  const interval = document.getElementById('interval').value;
  
  // Validar campos
  if (!symbol || !dateFrom || !dateTo) {
    showMessage('Por favor completa todos los campos', 'error');
    return;
  }

  // Validar rango de fechas según intervalo
  const daysDiff = Math.floor((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
  
  if ((interval === '1m' && daysDiff > 7) || 
      (['2m', '5m', '15m', '30m'].includes(interval) && daysDiff > 60)) {
    showMessage(`⚠️ Advertencia: El intervalo ${interval} solo permite datos limitados. Yahoo Finance puede no devolver todos los datos solicitados.`, 'warning');
  }
  
  const loading = document.getElementById('loading');
  const btn = document.getElementById('downloadBtn');
  
  loading.classList.add('active');
  btn.disabled = true;
  document.getElementById('message').innerHTML = '';
  
  try {
    const period1 = Math.floor(new Date(dateFrom).getTime() / 1000);
    const period2 = Math.floor(new Date(dateTo).getTime() / 1000);
    
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;
    
    console.log('📡 Descargando desde Yahoo Finance...');
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.chart.result?.[0];
    
    if (!result) {
      throw new Error('No se encontraron datos para este símbolo');
    }
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    
    const rows = timestamps.map((t, i) => {
      if (quote.open[i] == null || quote.close[i] == null) return null;
      
      const date = new Date(t * 1000);
      let dateStr;
      
      // Formatear fecha según el intervalo
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
    
    if (rows.length === 0) {
      throw new Error('No se obtuvieron datos válidos');
    }
    
    currentData = rows;
    
    showMessage(`✅ ${rows.length} registros descargados para ${symbol} (${interval})`, 'success');
    renderStats(rows, interval);
    renderChart(rows, symbol, interval);
    renderTable(rows);
    downloadCSV(rows, symbol, interval);
    
  } catch (error) {
    showMessage(`❌ Error: ${error.message}`, 'error');
    console.error('Error completo:', error);
  } finally {
    loading.classList.remove('active');
    btn.disabled = false;
  }
}

/**
 * Muestra un mensaje en la interfaz
 */
function showMessage(text, type) {
  document.getElementById('message').innerHTML = 
    `<div class="alert ${type === 'success' ? 'success' : type === 'warning' ? 'warning' : ''}">${text}</div>`;
}

/**
 * Renderiza estadísticas de los datos
 */
function renderStats(rows, interval) {
  const closes = rows.map(r => r.close);
  const returns = [];
  
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i-1]) / closes[i-1]);
  }
  
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const median = sortedReturns[Math.floor(sortedReturns.length / 2)];
  
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];
  
  // Calcular volatilidad anualizada según el intervalo
  let periodsPerYear;
  switch(interval) {
    case '1m': periodsPerYear = 252 * 6.5 * 60; break;
    case '5m': periodsPerYear = 252 * 6.5 * 12; break;
    case '15m': periodsPerYear = 252 * 6.5 * 4; break;
    case '30m': periodsPerYear = 252 * 6.5 * 2; break;
    case '1h': periodsPerYear = 252 * 6.5; break;
    case '1d': periodsPerYear = 252; break;
    case '1wk': periodsPerYear = 52; break;
    case '1mo': periodsPerYear = 12; break;
    default: periodsPerYear = 252;
  }
  
  const annualVolatility = stdDev * Math.sqrt(periodsPerYear);
  
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Registros</div>
      <div class="stat-value">${rows.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Precio Mín</div>
      <div class="stat-value">$${min.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Precio Máx</div>
      <div class="stat-value">$${max.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Retorno Total</div>
      <div class="stat-value ${totalReturn < 0 ? 'negative' : ''}">${(totalReturn * 100).toFixed(2)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Retorno Promedio</div>
      <div class="stat-value ${avg < 0 ? 'negative' : ''}">${(avg * 100).toFixed(4)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Mediana</div>
      <div class="stat-value">${(median * 100).toFixed(4)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Desv. Estándar</div>
      <div class="stat-value">${(stdDev * 100).toFixed(4)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Vol. Anual</div>
      <div class="stat-value">${(annualVolatility * 100).toFixed(2)}%</div>
    </div>
  `;
  
  document.getElementById('statsPanel').style.display = 'block';
}

/**
 * Renderiza el gráfico de precios
 */
function renderChart(rows, symbol, interval) {
  const labels = rows.map(r => r.date);
  const closes = rows.map(r => r.close);
  
  if (chartInstance) chartInstance.destroy();
  
  const ctx = document.getElementById('priceChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${symbol} - ${interval}`,
        data: closes,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { 
          ticks: { 
            maxTicksLimit: 15, 
            color: '#9ca3af'
          } 
        },
        y: { 
          ticks: { 
            color: '#9ca3af',
            callback: (value) => '$' + value.toFixed(2)
          }
        }
      },
      plugins: {
        legend: { labels: { color: '#e5e7eb' } },
        tooltip: {
          callbacks: {
            label: (context) => `Precio: $${context.parsed.y.toFixed(2)}`
          }
        }
      }
    }
  });
  
  document.getElementById('chartPanel').style.display = 'block';
}

/**
 * Renderiza la tabla de datos históricos
 */
function renderTable(rows) {
  document.getElementById('rowCount').textContent = rows.length;
  
  let html = '<table><thead><tr><th>Fecha/Hora</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody>';
  
  rows.forEach(r => {
    html += `<tr>
      <td>${r.date}</td>
      <td>$${r.open.toFixed(2)}</td>
      <td>$${r.high.toFixed(2)}</td>
      <td>$${r.low.toFixed(2)}</td>
      <td>$${r.close.toFixed(2)}</td>
      <td>${r.volume.toLocaleString()}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  document.getElementById('tableContainer').innerHTML = html;
  document.getElementById('tablePanel').style.display = 'block';
}

/**
 * Descarga los datos como CSV
 */
function downloadCSV(rows, symbol, interval) {
  let csv = 'DateTime,Open,High,Low,Close,Volume\n';
  rows.forEach(r => {
    csv += `${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `data_${symbol}_${interval}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}