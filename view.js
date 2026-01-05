// view.js
export default class TradingView {
  constructor() {
    this.inputs = {
      symbol: document.getElementById('inputSymbol'),
      dateFrom: document.getElementById('inputDateFrom'),
      dateTo: document.getElementById('inputDateTo'),
      interval: document.getElementById('inputInterval')
    };
    this.buttons = {
      visualize: document.getElementById('btnVisualize'),
      download: document.getElementById('btnDownload')
    };
    this.loader = document.getElementById('loader');
    this.resultsContainer = document.getElementById('resultsContainer');
    this.chartInstance = null;
    this.patternsChart = null;

    this.inputs.dateTo.valueAsDate = new Date();
    this._initTabs();
  }

  getFormData() {
    return {
      symbol: this.inputs.symbol.value.trim().toUpperCase(),
      dateFrom: this.inputs.dateFrom.value,
      dateTo: this.inputs.dateTo.value,
      interval: this.inputs.interval.value
    };
  }

  toggleLoading(isLoading) {
    if (isLoading) {
      this.loader.classList.add('active');
      this.buttons.visualize.disabled = true;
      this.buttons.download.disabled = true;
    } else {
      this.loader.classList.remove('active');
      this.buttons.visualize.disabled = false;
      this.buttons.download.disabled = false;
    }
  }

  showError(message) {
    alert(`❌ Error: ${message}`);
  }

  showResultsPanel() {
    this.resultsContainer.classList.remove('hidden');
  }

  // renderStatistics(stats) 

  // En view.js, reemplaza renderStatistics con esto:

  renderStatistics(stats, extremes) {
    const container = document.getElementById('statsGrid');
    const fmtPct = (val) => `${(val * 100).toFixed(2)}%`;
    const color = (val) => val >= 0 ? 'text-green' : 'text-red';

    // 1. Las Tarjetas Superiores (Ya las teníamos)
    let html = `
      <div class="stat-card">
        <div>Velas Analizadas</div>
        <div class="stat-val" style="color:#94a3b8">${stats.count}</div>
      </div>
      <div class="stat-card" style="border-color: #3b82f6">
        <div style="color:#3b82f6; font-weight:bold;">Promedio Diario</div>
        <div class="stat-val ${color(stats.avgReturn)}">${fmtPct(stats.avgReturn)}</div>
      </div>
      <div class="stat-card" style="border-color: #8b5cf6">
        <div style="color:#8b5cf6; font-weight:bold;">Mediana Diaria</div>
        <div class="stat-val ${color(stats.medianReturn)}">${fmtPct(stats.medianReturn)}</div>
      </div>
      <div class="stat-card" style="border-color: #fbbf24">
        <div style="color:#fbbf24; font-weight:bold;">Volatilidad</div>
        <div class="stat-val" style="color:#fbbf24">${fmtPct(stats.volatility)}</div>
      </div>
    `;

    // 2. NUEVO: Las Tablas de Extremos (Top 5 Mejores y Peores)
    // Usamos un grid interno para ponerlas una al lado de la otra
    html += `
      <div style="grid-column: 1 / -1; margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        
        <div class="panel" style="margin:0; padding:1rem; border: 1px solid #22c55e;">
          <h3 style="color:#22c55e; margin-bottom:0.5rem; text-align:center;">🚀 Top 5 Mejores Días</h3>
          <table style="width:100%">
            ${extremes.best.map(d => `
              <tr>
                <td style="text-align:left; color:#94a3b8">${d.dateStr.split(' ')[0]}</td>
                <td class="text-green" style="font-weight:bold; text-align:right">+${fmtPct(d.return)}</td>
              </tr>
            `).join('')}
          </table>
        </div>

        <div class="panel" style="margin:0; padding:1rem; border: 1px solid #ef4444;">
          <h3 style="color:#ef4444; margin-bottom:0.5rem; text-align:center;">💀 Top 5 Peores Días</h3>
          <table style="width:100%">
            ${extremes.worst.map(d => `
              <tr>
                <td style="text-align:left; color:#94a3b8">${d.dateStr.split(' ')[0]}</td>
                <td class="text-red" style="font-weight:bold; text-align:right">${fmtPct(d.return)}</td>
              </tr>
            `).join('')}
          </table>
        </div>

      </div>
    `;

    container.innerHTML = html;
  }

  renderHistoricalTable(data) {
    const tbody = document.querySelector('#historicalTable tbody');
    const reversedData = [...data].reverse();

    const rowsHtml = reversedData.slice(0, 500).map(row => {
      const colorClass = row.return >= 0 ? 'text-green' : 'text-red';
      const sign = row.return > 0 ? '+' : '';
      
      return `
        <tr>
          <td>${row.dateStr}</td>
          <td>${row.open.toFixed(2)}</td>
          <td>${row.high.toFixed(2)}</td>
          <td>${row.low.toFixed(2)}</td>
          <td style="font-weight:bold">${row.close.toFixed(2)}</td>
          <td>${row.volume.toLocaleString()}</td>
          <td class="${colorClass}" style="font-weight:bold">${sign}${row.returnPct.toFixed(2)}%</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  renderChart(data, symbol) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(ctx, {
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
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
        },
        plugins: { legend: { labels: { color: '#e2e8f0' } } }
      }
    });
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.add('hidden'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
      });
    });
  }

  bindVisualize(handler) {
    this.buttons.visualize.addEventListener('click', handler);
  }

  bindDownload(handler) {
    this.buttons.download.addEventListener('click', handler);
  }

  //patron dias de la semana

renderSeasonalityChart(seasonalityData) {
    const ctx = document.getElementById('patternsChart').getContext('2d');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // Colores dinámicos: Verde si es > 0, Rojo si es < 0
    const colors = seasonalityData.averages.map(val => 
      val >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
    );
    
    // Bordes
    const borders = seasonalityData.averages.map(val => 
      val >= 0 ? '#22c55e' : '#ef4444'
    );

    if (this.patternsChart) {
      this.patternsChart.destroy();
    }

    this.patternsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Rendimiento Promedio (%)',
          data: seasonalityData.averages.map(val => val * 100), // Convertir a porcentaje
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Promedio: ${ctx.parsed.y.toFixed(4)}%`
            }
          }
        }
      }
    });
  }

}