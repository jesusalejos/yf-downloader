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

  renderStatistics(stats) {
    const container = document.getElementById('statsGrid');
    const fmtPct = (val) => `${(val * 100).toFixed(2)}%`;
    const color = (val) => val >= 0 ? 'text-green' : 'text-red';

    container.innerHTML = `
      <div class="stat-card">
        <div>Velas Analizadas</div>
        <div class="stat-val">${stats.count}</div>
      </div>
      <div class="stat-card">
        <div>Precio Actual</div>
        <div class="stat-val text-green">$${stats.lastPrice.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div>Retorno Total</div>
        <div class="stat-val ${color(stats.totalReturn)}">${fmtPct(stats.totalReturn)}</div>
      </div>
      <div class="stat-card">
        <div>Volatilidad (StdDev)</div>
        <div class="stat-val" style="color:#fbbf24">${fmtPct(stats.volatility)}</div>
      </div>
    `;
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
}