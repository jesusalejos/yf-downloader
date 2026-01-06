// model.js
export default class TradingModel {
  constructor() {
    this.data = [];
    this.symbol = '';
    this.interval = '';
  }

  // --- OBTENCIÓN DE DATOS (DATA FETCHING) ---
  async fetchData(symbol, interval, fromDate, toDate) {
    this.symbol = symbol;
    this.interval = interval;
    
    const p1 = Math.floor(new Date(fromDate).getTime() / 1000);
    const p2 = Math.floor(new Date(toDate).getTime() / 1000);
    
    // Validaciones de intervalo de Yahoo
    const days = (p2 - p1) / 86400;
    if (interval === '1m' && days > 7) throw new Error("Intervalo 1m solo permite últimos 7 días.");
    if (interval === '1h' && days > 730) throw new Error("Intervalo 1h solo permite últimos 2 años.");

    try {
      console.log("🔄 Intentando vía Proxy Público...");
      // Opción A: Proxy gratuito (puede fallar a veces)
      const publicUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${p1}&period2=${p2}`;
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(publicUrl)}`;
      
      const data = await this._makeRequest(proxy);
      this.data = this._processRawData(data);
      console.log("✅ Datos obtenidos vía Proxy Público");
      return this.data;

    } catch (publicError) {
      console.warn("⚠️ Falló Proxy Público, intentando Backend local...", publicError);
      
      // Opción B: Tu Backend local (server.js)
      try {
        const backendUrl = `/api/yahoo?symbol=${symbol}&interval=${interval}&period1=${p1}&period2=${p2}`;
        const data = await this._makeRequest(backendUrl);
        this.data = this._processRawData(data);
        console.log("✅ Datos obtenidos vía Backend Propio");
        return this.data;

      } catch (backendError) {
        console.error("❌ Fallaron todas las vías");
        throw new Error("No se pudo conectar con Yahoo Finance. Revisa que tu servidor (server.js) esté corriendo.");
      }
    }
  }

  // Ayudante para peticiones HTTP
  async _makeRequest(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("Estructura de datos inválida recibida de Yahoo");
    return result;
  }

  // Procesamiento de datos crudos a formato limpio
  _processRawData(result) {
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const cleanData = [];

    timestamps.forEach((t, i) => {
      // Filtrar nulos
      if (quotes.close[i] === null) return;

      const close = quotes.close[i];
      let ret = 0;
      // Calcular retorno diario
      if (i > 0 && quotes.close[i-1]) {
        ret = (close - quotes.close[i-1]) / quotes.close[i-1];
      }

      cleanData.push({
        dateObj: new Date(t * 1000),
        dateStr: new Date(t * 1000).toISOString().slice(0, 10), // YYYY-MM-DD
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: close,
        volume: quotes.volume[i],
        return: ret,
        returnPct: (ret * 100)
      });
    });

    return cleanData;
  }

  // --- ESTADÍSTICAS BÁSICAS ---
  getStatistics() {
    if (this.data.length === 0) return null;

    const returns = this.data.map(d => d.return);
    const closes = this.data.map(d => d.close);
    
    // Promedio
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Mediana
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const mid = Math.floor(sortedReturns.length / 2);
    const median = sortedReturns.length % 2 !== 0
      ? sortedReturns[mid]
      : (sortedReturns[mid - 1] + sortedReturns[mid]) / 2;

    // Desviación Estándar (Volatilidad)
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Retorno Total del periodo
    const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];

    return {
      count: this.data.length,
      lastPrice: closes[closes.length - 1],
      totalReturn: totalReturn,
      avgReturn: avg,
      medianReturn: median,
      volatility: stdDev
    };
  }

  // Top Mejores y Peores días
  getExtremes() {
    if (this.data.length === 0) return null;
    const sorted = [...this.data].sort((a, b) => b.return - a.return);
    return {
      best: sorted.slice(0, 5),
      worst: sorted.slice(-5).reverse()
    };
  }

  // --- ANÁLISIS DE PATRONES TEMPORALES ---
  
  // Por día de la semana
  getSeasonality() {
    if (this.data.length === 0) return null;
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    this.data.forEach(row => {
      const dayIndex = row.dateObj.getDay(); // 0 = Domingo
      sums[dayIndex] += row.return;
      counts[dayIndex]++;
    });

    return {
      averages: sums.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0),
      counts: counts
    };
  }

  // Por mes del año
  getMonthlySeasonality() {
    if (this.data.length === 0) return null;
    const sums = new Array(12).fill(0);
    const counts = new Array(12).fill(0);

    this.data.forEach(row => {
      const monthIndex = row.dateObj.getMonth(); // 0 = Enero
      sums[monthIndex] += row.return;
      counts[monthIndex]++;
    });

    return {
      averages: sums.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0),
      counts: counts
    };
  }

  // --- ANÁLISIS DE RACHAS (STREAKS) ---
  getStreaksAnalysis() {
    if (this.data.length === 0) return null;

    let currentType = 0; // 1: Win, -1: Loss
    let currentCount = 0;
    let currentCumRet = 0;
    let currentStart = this.data[0].dateStr;

    let maxWinStreak = { count: 0, return: 0, start: '-', end: '-' };
    let maxLossStreak = { count: 0, return: 0, start: '-', end: '-' };

    this.data.forEach((row, i) => {
      const ret = row.return;
      const isPositive = ret >= 0;

      // Continuar racha
      if (i > 0 && ((isPositive && currentType === 1) || (!isPositive && currentType === -1))) {
        currentCount++;
        currentCumRet = ((1 + currentCumRet) * (1 + ret)) - 1;
      } else {
        // Racha terminada, verificar récord
        if (i > 0) {
          const prevDate = this.data[i-1].dateStr;
          if (currentType === 1) { 
            if (currentCount > maxWinStreak.count) maxWinStreak = { count: currentCount, return: currentCumRet, start: currentStart, end: prevDate };
          } else if (currentType === -1) { 
            if (currentCount > maxLossStreak.count) maxLossStreak = { count: currentCount, return: currentCumRet, start: currentStart, end: prevDate };
          }
        }
        // Iniciar nueva racha
        currentType = isPositive ? 1 : -1;
        currentCount = 1;
        currentCumRet = ret;
        currentStart = row.dateStr;
      }
    });

    return {
      longestWin: maxWinStreak,
      longestLoss: maxLossStreak
    };
  }

  // --- ANÁLISIS DE CHOQUE Y CORRECCIÓN (SHOCK & CORRECTION) ---
  
  // 1. Calcular ATR (Average True Range)
  calculateATR(period = 14) {
    if (this.data.length === 0) return [];
    
    let trs = [];
    for (let i = 1; i < this.data.length; i++) {
        const high = this.data[i].high;
        const low = this.data[i].low;
        const prevClose = this.data[i - 1].close;
        
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trs.push(tr);
    }

    let atrs = new Array(period).fill(null); // Relleno inicial
    for (let i = period; i < trs.length; i++) {
        const sum = trs.slice(i - period, i).reduce((a, b) => a + b, 0);
        atrs.push(sum / period);
    }
    return [null, ...atrs]; // Alinear índices
  }

  // 2. Ejecutar lógica de correcciones
  runCorrectionAnalysis(atrPeriod = 14, impulseMultiplier = 2.0, lookForward = 5) {
    const atrs = this.calculateATR(atrPeriod);
    const events = [];

    // Iteramos ignorando el inicio (cálculo ATR) y el final (margen futuro)
    for (let i = atrPeriod + 1; i < this.data.length - lookForward; i++) {
        const current = this.data[i];
        const currentATR = atrs[i];
        
        if (!currentATR) continue;

        const bodySize = Math.abs(current.close - current.open);
        const isBullish = current.close > current.open; // Solo miramos impulsos alcistas
        
        // CONDICIÓN: Vela alcista fuerte (Cuerpo > X veces el ATR)
        if (isBullish && bodySize > (currentATR * impulseMultiplier)) {
            
            const impulseHigh = current.close;
            let minPrice = impulseHigh;
            let daysToLow = 0;

            // Mirar hacia el futuro para encontrar el punto más bajo (Pullback)
            for (let j = 1; j <= lookForward; j++) {
                const futureCandle = this.data[i + j];
                if (futureCandle.low < minPrice) {
                    minPrice = futureCandle.low;
                    daysToLow = j;
                }
            }

            // Calcular porcentajes
            const drawdownPct = ((impulseHigh - minPrice) / impulseHigh) * 100;
            const drawdownAtr = (impulseHigh - minPrice) / currentATR;

            events.push({
                date: current.dateStr,
                impulseSize: (bodySize / currentATR).toFixed(2),
                correctionDepthPct: drawdownPct.toFixed(2),
                correctionDepthATR: drawdownAtr.toFixed(2),
                daysToBottom: daysToLow
            });
        }
    }

    // Generar resumen estadístico
    if (events.length > 0) {
        // Promedio profundidad en ATR
        const avgDepthATR = events.reduce((sum, e) => sum + parseFloat(e.correctionDepthATR), 0) / events.length;
        
        // Promedio profundidad en Porcentaje (NUEVO para tu frase)
        const avgDepthPct = events.reduce((sum, e) => sum + parseFloat(e.correctionDepthPct), 0) / events.length;
        
        // Promedio duración
        const avgDays = events.reduce((sum, e) => sum + e.daysToBottom, 0) / events.length;
        
        return {
            success: true,
            totalEvents: events.length,
            avgCorrectionATR: avgDepthATR.toFixed(2),
            avgCorrectionPct: avgDepthPct.toFixed(2), // <--- Dato clave agregado
            avgDuration: avgDays.toFixed(1),
            details: events
        };
    } else {
        return { success: false, message: "No se encontraron eventos de alta volatilidad con estos parámetros." };
    }
  }

  // --- EXPORTAR A CSV ---
  getCSVContent() {
    let csv = 'Date,Open,High,Low,Close,Volume,Return(%)\n';
    this.data.forEach(row => {
      csv += `${row.dateStr},${row.open},${row.high},${row.low},${row.close},${row.volume},${row.returnPct.toFixed(2)}\n`;
    });
    return csv;
  }
}