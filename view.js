// view.js
export default class TradingView {
  constructor() {
    // 1. Referencias al DOM
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
    
    // 2. Referencias a Gráficos (Chart.js instances)
    this.chartInstance = null;      // Gráfico de Precio
    this.patternsChart = null;      // Gráfico Semanal
    this.monthlyChart = null;       // Gráfico Mensual

    // Inicializar fecha 'Hasta' con el día de hoy
    this.inputs.dateTo.valueAsDate = new Date();
    
    // Iniciar lógica de pestañas
    this._initTabs();
  }

  // --- Métodos de Interacción ---

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

  // --- Métodos de Renderizado ---

  // 1. ESTADÍSTICAS GENERALES Y EXTREMOS
  renderStatistics(stats, extremes) {
    const container = document.getElementById('statsGrid');
    const fmtPct = (val) => `${(val * 100).toFixed(4)}%`;
    const color = (val) => val >= 0 ? 'text-green' : 'text-red';

    let html = `
      <div class="stat-card">
        <div>Velas Analizadas</div>
        <div class="stat-val" style="color:#94a3b8">${stats.count}</div>
      </div>
      
      <div class="stat-card" style="border-color: #3b82f6">
        <div style="color:#3b82f6; font-weight:bold;">Promedio Diario</div>
        <div class="stat-val ${color(stats.avgReturn)}">${fmtPct(stats.avgReturn)}</div>
        <div style="font-size:0.7rem; color:#64748b">Esperanza Matemática</div>
      </div>

      <div class="stat-card" style="border-color: #8b5cf6">
        <div style="color:#8b5cf6; font-weight:bold;">Mediana Diaria</div>
        <div class="stat-val ${color(stats.medianReturn)}">${fmtPct(stats.medianReturn)}</div>
        <div style="font-size:0.7rem; color:#64748b">Día "Típico"</div>
      </div>

      <div class="stat-card" style="border-color: #fbbf24">
        <div style="color:#fbbf24; font-weight:bold;">Volatilidad (SD)</div>
        <div class="stat-val" style="color:#fbbf24">${fmtPct(stats.volatility)}</div>
        <div style="font-size:0.7rem; color:#64748b">Riesgo / Variabilidad</div>
      </div>
    `;

    // Tablas de Top 5 Mejores y Peores
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

  // 2. TABLA HISTÓRICA COMPLETA
  renderHistoricalTable(data) {
    const tbody = document.querySelector('#historicalTable tbody');
    // Descendente: Lo más nuevo primero
    const reversedData = [...data].reverse();

    // Limitamos a 500 filas para performance
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

  // 3. GRÁFICO DE PRECIO (Línea)
  renderChart(data, symbol) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    if (this.chartInstance) this.chartInstance.destroy();

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

  // 4. GRÁFICO ESTACIONALIDAD (Semanal)
  renderSeasonalityChart(seasonalityData) {
    const ctx = document.getElementById('patternsChart').getContext('2d');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const colors = seasonalityData.averages.map(val => val >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)');
    const borders = seasonalityData.averages.map(val => val >= 0 ? '#22c55e' : '#ef4444');

    if (this.patternsChart) this.patternsChart.destroy();

    this.patternsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Rendimiento Promedio (%)',
          data: seasonalityData.averages.map(val => val * 100),
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // 5. GRÁFICO MENSUAL
  renderMonthlyChart(monthlyData) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const colors = monthlyData.averages.map(val => val >= 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)');
    const borders = monthlyData.averages.map(val => val >= 0 ? '#3b82f6' : '#ef4444');

    if (this.monthlyChart) this.monthlyChart.destroy();

    this.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Retorno Promedio (%)',
          data: monthlyData.averages.map(val => val * 100),
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // 6. ANÁLISIS DE RACHAS (COMPLETO)
  renderStreaks(streaks) {
    const container = document.getElementById('streaksGrid');
    const tableBody = document.querySelector('#streaksTable tbody'); 
    
    // Helpers
    const fmtPct = (val) => `${(val * 100).toFixed(2)}%`;
    const fmtDate = (dateStr) => dateStr && dateStr.length >= 10 ? dateStr.slice(0, 10) : '-';
    const color = (val) => val >= 0 ? 'text-green' : 'text-red';
    const dateHtml = (s, e) => `
      <div style="font-size:0.75rem; color:#64748b; margin-top:0.5rem; border-top:1px solid #334155; padding-top:0.3rem;">
        <div>📅 ${fmtDate(s)} ⮕ ${fmtDate(e)}</div>
      </div>
    `;

    // --- A. TARJETAS DE RÉCORDS (Siempre visibles) ---
    container.innerHTML = `
      <div class="stat-card" style="border-color: #22c55e;">
        <div style="color:#22c55e; font-weight:bold; font-size:0.9rem;">Racha Alcista Más Larga</div>
        <div class="stat-val text-green">${streaks.longestWin.count} Días</div>
        <div style="font-size:0.8rem; color:#94a3b8">Generó: ${fmtPct(streaks.longestWin.return)}</div>
        ${dateHtml(streaks.longestWin.start, streaks.longestWin.end)}
      </div>

      <div class="stat-card" style="border-color: #4ade80;">
        <div style="color:#4ade80; font-weight:bold; font-size:0.9rem;">Mejor "Run" Acumulado</div>
        <div class="stat-val text-green">${fmtPct(streaks.bestReturn.return)}</div>
        <div style="font-size:0.8rem; color:#94a3b8">En ${streaks.bestReturn.count} días</div>
        ${dateHtml(streaks.bestReturn.start, streaks.bestReturn.end)}
      </div>

      <div class="stat-card" style="border-color: #ef4444;">
        <div style="color:#ef4444; font-weight:bold; font-size:0.9rem;">Racha Bajista Más Larga</div>
        <div class="stat-val text-red">${streaks.longestLoss.count} Días</div>
        <div style="font-size:0.8rem; color:#94a3b8">Perdió: ${fmtPct(streaks.longestLoss.return)}</div>
        ${dateHtml(streaks.longestLoss.start, streaks.longestLoss.end)}
      </div>

      <div class="stat-card" style="border-color: #b91c1c;">
        <div style="color:#b91c1c; font-weight:bold; font-size:0.9rem;">Peor Caída Consecutiva</div>
        <div class="stat-val text-red">${fmtPct(streaks.worstReturn.return)}</div>
        <div style="font-size:0.8rem; color:#94a3b8">En ${streaks.worstReturn.count} días</div>
        ${dateHtml(streaks.worstReturn.start, streaks.worstReturn.end)}
      </div>
    `;

    // --- B. ANÁLISIS "QUÉ PASA DESPUÉS" (Resumen) ---
    // Filtramos solo rachas relevantes (>= 4 días)
    const longStreaks = streaks.history.filter(s => s.count >= 4);

    const winStreaks = longStreaks.filter(s => s.type === 'WIN');
    const lossStreaks = longStreaks.filter(s => s.type === 'LOSS');

    // Promedios del día siguiente
    const avgAfterWin = winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b.nextRet, 0) / winStreaks.length : 0;
    const avgAfterLoss = lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b.nextRet, 0) / lossStreaks.length : 0;

    // Probabilidades de Reversión
    const probRevWin = winStreaks.length > 0 ? winStreaks.filter(s => s.nextRet < 0).length / winStreaks.length : 0;
    const probRevLoss = lossStreaks.length > 0 ? lossStreaks.filter(s => s.nextRet > 0).length / lossStreaks.length : 0;

    // Inyectar o buscar el contenedor de resumen
    let summaryDiv = document.getElementById('postStreakSummary');
    if (!summaryDiv) {
      summaryDiv = document.createElement('div');
      summaryDiv.id = 'postStreakSummary';
      summaryDiv.className = 'grid';
      summaryDiv.style.marginTop = '2rem';
      // Insertar antes de la tabla
      const tableContainer = document.querySelector('.table-scroll');
      tableContainer.parentNode.insertBefore(summaryDiv, tableContainer);
    }

    summaryDiv.innerHTML = `
      <div class="panel" style="margin:0; border-left: 4px solid #22c55e;">
        <h4 style="color:#e2e8f0; margin-bottom:0.5rem">🟢 Post-Racha Alcista (4+ días)</h4>
        <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem">Casos: ${winStreaks.length}</div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#cbd5e1">Retorno Siguiente Día:</span>
          <span class="${color(avgAfterWin)}" style="font-weight:bold">${fmtPct(avgAfterWin)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#cbd5e1">Prob. de Caída (Reversión):</span>
          <span style="color:#e2e8f0">${fmtPct(probRevWin)}</span>
        </div>
      </div>

      <div class="panel" style="margin:0; border-left: 4px solid #ef4444;">
        <h4 style="color:#e2e8f0; margin-bottom:0.5rem">🔴 Post-Racha Bajista (4+ días)</h4>
        <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem">Casos: ${lossStreaks.length}</div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#cbd5e1">Retorno Siguiente Día:</span>
          <span class="${color(avgAfterLoss)}" style="font-weight:bold">${fmtPct(avgAfterLoss)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#cbd5e1">Prob. de Rebote (Reversión):</span>
          <span style="color:#e2e8f0">${fmtPct(probRevLoss)}</span>
        </div>
      </div>
    `;

    // --- C. TABLA DETALLADA (Filtrada) ---
    // Asegurar cabecera "Día Siguiente"
    const tableHead = document.querySelector('#streaksTable thead tr');
    if (tableHead && tableHead.children.length === 5) {
        const th = document.createElement('th');
        th.innerText = 'Día Siguiente';
        tableHead.appendChild(th);
    }

    // Actualizar título
    const titleHeader = document.querySelector('#tab-patterns h3:last-of-type');
    if (titleHeader) titleHeader.textContent = `📜 Historial de Rachas Relevantes (≥ 4 días)`;

    if (longStreaks.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8;">No se encontraron rachas de 4 días o más.</td></tr>';
      return;
    }

    const rowsHtml = longStreaks.map(s => {
      const isWin = s.type === 'WIN';
      const colorClass = isWin ? 'text-green' : 'text-red';
      const icon = isWin ? '📈' : '📉';
      const bg = isWin ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)';
      
      const nextColor = s.nextRet >= 0 ? 'text-green' : 'text-red';
      const nextSign = s.nextRet > 0 ? '+' : '';

      return `
        <tr style="background:${bg}">
          <td class="${colorClass}" style="font-weight:bold;">${icon} ${s.type}</td>
          <td style="font-weight:bold; color:#e2e8f0;">${s.count} días</td>
          <td class="${colorClass}" style="font-weight:bold;">${fmtPct(s.return)}</td>
          <td style="font-size:0.85rem; color:#94a3b8;">${fmtDate(s.start)}</td>
          <td style="font-size:0.85rem; color:#94a3b8;">${fmtDate(s.end)}</td>
          <td class="${nextColor}" style="font-weight:bold;">${nextSign}${fmtPct(s.nextRet)}</td>
        </tr>
      `;
    }).join('');

    tableBody.innerHTML = rowsHtml;
  }

  // 7. ANÁLISIS DE CORRECCIONES (Movimientos fuertes)
  renderCorrections(analysis) {
    const container = document.getElementById('correctionsGrid');
    const fmtPct = (val) => `${(val * 100).toFixed(2)}%`;
    const color = (val) => val >= 0 ? 'text-green' : 'text-red';

    if (!analysis || (analysis.bullEventCount === 0 && analysis.bearEventCount === 0)) {
      container.innerHTML = '<div style="color:#94a3b8; text-align:center;">No se detectaron movimientos fuertes (>1.5 SD) en este periodo.</div>';
      return;
    }

    const bullHtml = `
      <div class="panel" style="border-left: 4px solid #22c55e; margin:0;">
        <h4 style="color:#e2e8f0; margin-bottom:0.5rem;">🚀 Post-Subida Fuerte</h4>
        <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:1rem;">Eventos: ${analysis.bullEventCount} (Ref: >${fmtPct(analysis.threshold)})</div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:#cbd5e1;">Retorno Promedio:</span>
          <span class="${color(analysis.avgAfterBull)}" style="font-weight:bold;">${fmtPct(analysis.avgAfterBull)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#cbd5e1;">Prob. Continuación:</span>
          <span style="color:#e2e8f0;">${fmtPct(analysis.bullContinuation)}</span>
        </div>
        <p style="font-size:0.75rem; margin-top:0.5rem; color:#64748b;">
          ${analysis.avgAfterBull < 0 ? '⚠️ Tiende a corregir' : '✅ Tiende a seguir subiendo'}
        </p>
      </div>
    `;

    const bearHtml = `
      <div class="panel" style="border-left: 4px solid #ef4444; margin:0;">
        <h4 style="color:#e2e8f0; margin-bottom:0.5rem;">🩸 Post-Caída Fuerte</h4>
        <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:1rem;">Eventos: ${analysis.bearEventCount} (Ref: < -${fmtPct(analysis.threshold)})</div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:#cbd5e1;">Retorno Promedio:</span>
          <span class="${color(analysis.avgAfterBear)}" style="font-weight:bold;">${fmtPct(analysis.avgAfterBear)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#cbd5e1;">Prob. Continuación:</span>
          <span style="color:#e2e8f0;">${fmtPct(analysis.bearContinuation)}</span>
        </div>
        <p style="font-size:0.75rem; margin-top:0.5rem; color:#64748b;">
          ${analysis.avgAfterBear > 0 ? '✅ Tiende a rebotar' : '⚠️ Tiende a seguir cayendo'}
        </p>
      </div>
    `;

    container.innerHTML = bullHtml + bearHtml;
  }

  // --- Manejo interno de Tabs ---
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

  // Enlace de Eventos
  bindVisualize(handler) {
    this.buttons.visualize.addEventListener('click', handler);
  }

  bindDownload(handler) {
    this.buttons.download.addEventListener('click', handler);
  }
}