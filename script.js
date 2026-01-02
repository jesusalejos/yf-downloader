// Variables globales
let chartInstance = null;
let currentData = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
  // Por defecto, fecha de fin es hoy
  document.getElementById('dateTo').valueAsDate = new Date();
  updateIntervalNote();
});

/**
 * Establece el símbolo del activo al hacer clic en los botones rápidos
 */
function setSymbol(symbol) {
  document.getElementById('symbol').value = symbol;
}

/**
 * Actualiza la nota de ayuda según el intervalo seleccionado
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
 * Descarga datos usando TU SERVIDOR LOCAL (server.js)
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
    
    // --- CAMBIO CLAVE AQUÍ ---
    // Llamamos a la ruta /api/yahoo que definiste en server.js
    const localUrl = `/api/yahoo?symbol=${symbol}&interval=${interval}&period1=${period1}&period2=${period2}`;
    
    console.log('📡 Contactando a servidor local...');
    
    const response = await fetch(localUrl);
    
    if (!response.ok) {
      // Si el servidor local dio error (ej: 500), lanzamos el mensaje
      const errJson = await response.json();
      throw new Error(errJson.error || `Error HTTP ${response.status}`);
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
    
    // Ejecutar funciones de visualización
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
 * Renderiza estadísticas completas (Tarea 1 y 2 de la Asignación)
 */
function renderStats(rows, interval) {
  // 1. PREPARAR DATOS
  const dailyReturns = []; 
  const closes = rows.map(r => r.close);
  
  // Nombres para los días
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayStats = {}; // Acumulador por día

  for (let i = 1; i < rows.length; i++) {
    const currentPrice = rows[i].close;
    const prevPrice = rows[i-1].close;
    
    // Rendimiento simple: (Actual - Anterior) / Anterior
    const ret = (currentPrice - prevPrice) / prevPrice;
    
    dailyReturns.push({
      date: rows[i].date,
      value: ret,
      dayOfWeek: new Date(rows[i].timestamp * 1000).getDay() // 0-6
    });

    // Agrupar por día de la semana
    const dayIndex = new Date(rows[i].timestamp * 1000).getDay();
    if (!dayStats[dayIndex]) dayStats[dayIndex] = [];
    dayStats[dayIndex].push(ret);
  }

  // 2. CÁLCULOS ESTADÍSTICOS
  const values = dailyReturns.map(x => x.value);
  
  // Promedio
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  
  // Mediana
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  
  // Desviación Estándar
  const variance = values.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Retorno Total
  const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];

  // 3. RANKING (Top 5 y Bottom 5)
  const sortedByReturn = [...dailyReturns].sort((a, b) => b.value - a.value);
  const best5 = sortedByReturn.slice(0, 5);
  const worst5 = sortedByReturn.slice(-5).reverse();

  // 4. ANÁLISIS SEMANAL (Render HTML)
  let dayAnalysisHTML = '<div class="stat-card full-width"><h3>📅 Patrones por Día de la Semana</h3><div class="days-grid">';
  
  // Recorremos Lunes(1) a Viernes(5)
  [1, 2, 3, 4, 5].forEach(dayIdx => {
    const returnsForDay = dayStats[dayIdx] || [];
    if (returnsForDay.length > 0) {
      const avgDay = returnsForDay.reduce((a,b)=>a+b,0) / returnsForDay.length;
      const colorClass = avgDay >= 0 ? 'text-green' : 'text-red';
      dayAnalysisHTML += `
        <div class="day-stat">
          <span class="day-name">${dayNames[dayIdx]}</span>
          <span class="day-value ${colorClass}">${(avgDay * 100).toFixed(2)}%</span>
        </div>`;
    } else {
      dayAnalysisHTML += `
        <div class="day-stat">
          <span class="day-name">${dayNames[dayIdx]}</span>
          <span class="day-value">-</span>
        </div>`;
    }
  });
  dayAnalysisHTML += '</div></div>';

  // Helper para filas de tabla
  const generateTableRows = (list) => {
    return list.map(item => `
      <tr>
        <td style="font-size:0.8rem; color:#9ca3af;">${item.date.split(' ')[0]}</td>
        <td style="font-weight:bold; color: ${item.value >= 0 ? '#4ade80' : '#f87171'}">
          ${(item.value * 100).toFixed(2)}%
        </td>
      </tr>
    `).join('');
  };

  // 5. INYECTAR EN DOM
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Retorno Total</div>
      <div class="stat-value ${totalReturn < 0 ? 'negative' : ''}">${(totalReturn * 100).toFixed(2)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Promedio Diario</div>
      <div class="stat-value ${avg < 0 ? 'negative' : ''}">${(avg * 100).toFixed(2)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Mediana</div>
      <div class="stat-value">${(median * 100).toFixed(2)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Volatilidad (StdDev)</div>
      <div class="stat-value" style="color: #fbbf24">${(stdDev * 100).toFixed(2)}%</div>
    </div>

    ${dayAnalysisHTML}

    <div class="stat-card wide">
      <div class="stat-label">🚀 Mejores 5 Días</div>
      <table><tbody>${generateTableRows(best5)}</tbody></table>
    </div>
    
    <div class="stat-card wide">
      <div class="stat-label">💀 Peores 5 Días</div>
      <table><tbody>${generateTableRows(worst5)}</tbody></table>
    </div>
  `;
  
  document.getElementById('statsPanel').style.display = 'block';
}

/**
 * Renderiza el gráfico de precios con Chart.js
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
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: { 
          ticks: { 
            maxTicksLimit: 15, 
            color: '#9ca3af'
          },
          grid: { color: '#334155' }
        },
        y: { 
          ticks: { 
            color: '#9ca3af',
            callback: (value) => '$' + value.toFixed(2)
          },
          grid: { color: '#334155' }
        }
      },
      plugins: {
        legend: { labels: { color: '#e5e7eb' } },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#e5e7eb',
          bodyColor: '#e5e7eb',
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
 * Renderiza la tabla de datos raw
 */
function renderTable(rows) {
  document.getElementById('rowCount').textContent = rows.length;
  
  let html = '<table><thead><tr><th>Fecha</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Vol</th></tr></thead><tbody>';
  
  // Mostramos solo los últimos 100 para no saturar el DOM si son muchos
  const displayRows = rows.slice().reverse().slice(0, 100);
  
  displayRows.forEach(r => {
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
  if (rows.length > 100) {
      html += '<p style="text-align:center; color:#94a3b8; padding:10px;">(Mostrando últimos 100 registros)</p>';
  }
  
  document.getElementById('tableContainer').innerHTML = html;
  document.getElementById('tablePanel').style.display = 'block';
}

/**
 * Genera y descarga el CSV
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