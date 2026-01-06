export default class TradingView {
  constructor() {
    // --- Referencias a Inputs ---
    this.inputs = {
      symbol: document.getElementById('inputSymbol'),
      dateFrom: document.getElementById('inputDateFrom'),
      dateTo: document.getElementById('inputDateTo'),
      interval: document.getElementById('inputInterval')
    };

    // --- Referencias a Botones y Contenedores ---
    this.btnVisualize = document.getElementById('btnVisualize');
    this.btnDownload = document.getElementById('btnDownload');
    this.resultsContainer = document.getElementById('resultsContainer');
    this.loader = document.getElementById('loader');
    this.errorDiv = document.getElementById('error-message');

    // Instancias de Gráficos (para poder destruirlos y redibujarlos)
    this.chartInstances = {};

    // Inicializar Tabs
    this._initTabs();
    
    // Establecer fecha por defecto (Hoy)
    this.inputs.dateTo.value = new Date().toISOString().split('T')[0];
  }

  // --- MÉTODOS DE UI (Interfaz) ---

  getFormData() {
    return {
      symbol: this.inputs.symbol.value.toUpperCase(),
      dateFrom: this.inputs.dateFrom.value,
      dateTo: this.inputs.dateTo.value,
      interval: this.inputs.interval.value
    };
  }

  toggleLoading(show) {
    if(show) {
      this.loader.classList.add('active');
      this.errorDiv.classList.add('hidden');
      this.resultsContainer.classList.add('hidden');
    } else {
      this.loader.classList.remove('active');
    }
  }

  showError(msg) {
    this.errorDiv.textContent = `❌ ${msg}`;
    this.errorDiv.classList.remove('hidden');
    this.toggleLoading(false);
  }

  showResultsPanel() {
    this.resultsContainer.classList.remove('hidden');
    // Scroll suave hacia los resultados
    this.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // --- MÉTODOS DE RENDERIZADO (Dibujar datos) ---

  renderStatistics(stats, extremes) {
    const grid = document.getElementById('statsGrid');
    
    // Tarjetas principales
    const cards = [
      { label: 'Precio Actual', val: stats.lastPrice.toFixed(2), color: '#fff' },
      { label: 'Retorno Total', val: (stats.totalReturn * 100).toFixed(2) + '%', color: stats.totalReturn >= 0 ? '#10b981' : '#ef4444' },
      { label: 'Volatilidad (SD)', val: (stats.volatility * 100).toFixed(2) + '%', color: '#f59e0b' },
      { label: 'Muestras', val: stats.count, color: '#94a3b8' }
    ];

    grid.innerHTML = cards.map(c => `
      <div class="panel" style="text-align:center; padding:15px;">
        <span style="font-size:0.8rem; color:#94a3b8; text-transform:uppercase;">${c.label}</span>
        <div style="font-size:1.5rem; font-weight:bold; color:${c.color}; margin-top:5px;">${c.val}</div>
      </div>
    `).join('');

    // Listas Top 5 (Mejores y Peores)
    const renderList = (items, id) => {
      const el = document.getElementById(id);
      el.innerHTML = items.map(d => 
        `<li style="padding:5px 0; border-bottom:1px solid #1e293b; display:flex; justify-content:space-between;">
           <span>${d.dateStr}</span>
           <span class="${d.return >= 0 ? 'text-green' : 'text-red'}" style="font-weight:bold;">
             ${(d.return * 100).toFixed(2)}%
           </span>
         </li>`
      ).join('');
    };

    renderList(extremes.best, 'listBest');
    renderList(extremes.worst, 'listWorst');
  }

  renderChart(data, symbol) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Destruir gráfico anterior si existe para evitar superposiciones
    if (this.chartInstances.price) this.chartInstances.price.destroy();

    this.chartInstances.price = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.dateStr),
        datasets: [{
          label: `Precio ${symbol}`,
          data: data.map(d => d.close),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#334155' } }
        }
      }
    });
  }

  renderSeasonalityChart(seasonality) {
    const ctx = document.getElementById('patternsChart').getContext('2d');
    if (this.chartInstances.week) this.chartInstances.week.destroy();

    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const colors = seasonality.averages.map(v => v >= 0 ? '#10b981' : '#ef4444');

    this.chartInstances.week = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Retorno Promedio %',
          data: seasonality.averages.map(v => v * 100),
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#334155' } } }
      }
    });
  }

  renderMonthlyChart(monthly) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (this.chartInstances.month) this.chartInstances.month.destroy();

    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const colors = monthly.averages.map(v => v >= 0 ? '#10b981' : '#ef4444');

    this.chartInstances.month = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Mensualidad %',
          data: monthly.averages.map(v => v * 100),
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#334155' } } }
      }
    });
  }

  renderStreaks(streaks) {
    const grid = document.getElementById('streaksGrid');
    
    const card = (title, data, isGood) => `
      <div class="panel" style="text-align:center; padding:15px; border-left: 4px solid ${isGood ? '#10b981' : '#ef4444'}">
        <div style="font-size:0.8rem; color:#94a3b8;">${title}</div>
        <div style="font-size:1.8rem; font-weight:bold; color:#fff; margin:5px 0;">${data.count} <small style="font-size:1rem">días</small></div>
        <div style="font-size:0.9rem; color:${isGood ? '#10b981' : '#ef4444'}">
           Tot: ${(data.return * 100).toFixed(2)}%
        </div>
        <div style="font-size:0.7rem; color:#64748b; margin-top:5px;">${data.start}</div>
      </div>
    `;

    grid.innerHTML = 
      card('🔥 Mejor Racha Alcista', streaks.longestWin, true) +
      card('❄️ Peor Racha Bajista', streaks.longestLoss, false);
  }

  renderHistoricalTable(data) {
    const tbody = document.querySelector('#historicalTable tbody');
    // Renderizamos solo los últimos 100 para no bloquear el navegador
    const subset = data.slice().reverse().slice(0, 100); 
    
    tbody.innerHTML = subset.map(row => `
      <tr>
        <td>${row.dateStr}</td>
        <td>${row.open.toFixed(2)}</td>
        <td>${row.high.toFixed(2)}</td>
        <td>${row.low.toFixed(2)}</td>
        <td>${row.close.toFixed(2)}</td>
        <td>${(row.volume / 1000000).toFixed(2)}M</td>
        <td class="${row.return >= 0 ? 'text-green' : 'text-red'}">
          ${(row.return * 100).toFixed(2)}%
        </td>
      </tr>
    `).join('');
  }

  // --- (NUEVO) RENDERIZADO DEL ANÁLISIS DE CORRECCIONES ---
  renderCorrectionAnalysis(report) {
    const container = document.getElementById('correction-analysis-container');
    
    // 1. Manejo de error o falta de datos
    if (!report || !report.success) {
      container.innerHTML = `<div class="error-msg">${report ? report.message : 'No hay datos suficientes.'}</div>`;
      return;
    }

    // 2. Generación de la Frase "Insight" (Conclusión Automática)
    // Nota: Usamos report.avgCorrectionPct que añadimos en el Model
    const insightHTML = `
      <div style="margin-bottom: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="color: #bfdbfe; font-style: italic; margin: 0; font-size: 0.95rem; line-height: 1.5;">
          "Históricamente, tras un movimiento fuerte, el activo tiende a corregir un 
          <strong style="color: #60a5fa;">${report.avgCorrectionPct}%</strong> 
          en un promedio de 
          <strong style="color: #60a5fa;">${report.avgDuration} días</strong>."
        </p>
      </div>
    `;

    // 3. Renderizado de la Tarjeta Completa
    container.innerHTML = `
      <div class="report-card">
        
        ${insightHTML} <div class="report-stats-grid">
          <div class="report-stat">
            <span class="label">Eventos Detectados</span>
            <span class="value">${report.totalEvents}</span>
          </div>
          <div class="report-stat">
            <span class="label">Profundidad (ATR)</span>
            <span class="value">${report.avgCorrectionATR} <small>x ATR</small></span>
          </div>
          <div class="report-stat">
            <span class="label">Duración Media</span>
            <span class="value">${report.avgDuration} <small>días</small></span>
          </div>
        </div>

        <details>
          <summary>Ver registro detallado de eventos</summary>
          <ul>
            ${report.details.map(e => `
              <li>
                <span>📅 <strong>${e.date}</strong> (Impulso: ${e.impulseSize} ATR)</span>
                <span style="color: #94a3b8;">
                  ↘ Corrigió <span style="color:#f87171;">${e.correctionDepthPct}%</span> 
                  (${e.correctionDepthATR} ATR) en ${e.daysToBottom} días
                </span>
              </li>
            `).join('')}
          </ul>
        </details>
      </div>
    `;
  }

  // --- EVENTOS (Bindings) ---
  
  bindVisualize(handler) {
    this.btnVisualize.addEventListener('click', handler);
  }

  bindDownload(handler) {
    this.btnDownload.addEventListener('click', handler);
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Quitar clase active de todos
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        // Activar el seleccionado
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.remove('hidden');
      });
    });
  }
}