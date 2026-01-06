// model.js
export default class TradingModel {
  constructor() {
    this.data = [];
    this.symbol = '';
    this.interval = '';
  }

  async fetchData(symbol, interval, fromDate, toDate) {
    this.symbol = symbol;
    this.interval = interval;
    
    const p1 = Math.floor(new Date(fromDate).getTime() / 1000);
    const p2 = Math.floor(new Date(toDate).getTime() / 1000);
    
    this._validateInterval(interval, p1, p2);

    // INTENTO 1: Proxy Público (AllOrigins)
    // Ventaja: No carga tu servidor. Desventaja: A veces es lento o bloquea.
    try {
      console.log("🔄 Intentando vía Proxy Público...");
      const publicUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${p1}&period2=${p2}`;
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(publicUrl)}`;
      
      const data = await this._makeRequest(proxy);
      this.data = this._processRawData(data);
      console.log("✅ Datos obtenidos vía Proxy Público");
      return this.data;

    } catch (publicError) {
      console.warn("⚠️ Falló Proxy Público, activando comodín (Backend Propio)...", publicError);
      
      // INTENTO 2: Tu Backend Propio (Comodín)
      // Ventaja: Muy estable y rápido. Desventaja: Requiere que server.js esté corriendo.
      try {
        // La ruta relativa '/api/yahoo' asume que la web y el server están en el mismo dominio
        const backendUrl = `/api/yahoo?symbol=${symbol}&interval=${interval}&period1=${p1}&period2=${p2}`;
        
        const data = await this._makeRequest(backendUrl);
        this.data = this._processRawData(data);
        console.log("✅ Datos obtenidos vía Backend Propio");
        return this.data;

      } catch (backendError) {
        // Si ambos fallan, lanzamos el error final
        console.error("❌ Fallaron todas las vías");
        throw new Error("No se pudo conectar ni al proxy público ni al servidor de respaldo.");
      }
    }
  }

  // Helper para hacer el fetch y validar JSON
  async _makeRequest(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    
    // Validar estructura de Yahoo
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("Estructura de datos inválida");
    return result;
  }

  _processRawData(result) {
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const cleanData = [];

    timestamps.forEach((t, i) => {
      if (quotes.close[i] === null) return;

      const close = quotes.close[i];
      let ret = 0;
      if (i > 0 && quotes.close[i-1]) {
        ret = (close - quotes.close[i-1]) / quotes.close[i-1];
      }

      cleanData.push({
        dateObj: new Date(t * 1000),
        dateStr: new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '),
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

  _validateInterval(interval, p1, p2) {
    const days = (p2 - p1) / 86400;
    if (interval === '1m' && days > 7) throw new Error("Intervalo 1m solo permite últimos 7 días.");
    if (interval === '1h' && days > 730) throw new Error("Intervalo 1h solo permite últimos 2 años.");
  }

  // método getStatistics() 

  getStatistics() {
    if (this.data.length === 0) return null;

    // 1. Extraemos solo los rendimientos (returns)
    const returns = this.data.map(d => d.return);
    const closes = this.data.map(d => d.close);
    
    // 2. CÁLCULO DEL PROMEDIO (Media Aritmética)
    // Sumamos todo y dividimos entre la cantidad
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // 3. CÁLCULO DE LA MEDIANA
    // Ordenamos de menor a mayor y buscamos el valor del centro
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const mid = Math.floor(sortedReturns.length / 2);
    // Si es par, promediamos los dos del medio; si es impar, tomamos el del medio
    const median = sortedReturns.length % 2 !== 0
      ? sortedReturns[mid]
      : (sortedReturns[mid - 1] + sortedReturns[mid]) / 2;

    // 4. CÁLCULO DE LA DESVIACIÓN ESTÁNDAR (Volatilidad)
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Retorno Total acumulado
    const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];

    // Devolvemos el paquete completo con las etiquetas correctas
    return {
      count: this.data.length,
      lastPrice: closes[closes.length - 1],
      totalReturn: totalReturn,
      
      // Aquí están las 3 joyas de la Tarea 1.2:
      avgReturn: avg,       // El Promedio
      medianReturn: median, // La Mediana
      volatility: stdDev    // La Desviación Estándar
    };
  }
//Método para días extremos

// En model.js, agrega este nuevo método:

  getExtremes() {
    if (this.data.length === 0) return null;

    // Creamos una copia para no desordenar los datos originales
    // Ordenamos por retorno (de mayor a menor)
    const sorted = [...this.data].sort((a, b) => b.return - a.return);

    return {
      best: sorted.slice(0, 5),                // Los 5 primeros (Más altos)
      worst: sorted.slice(-5).reverse()        // Los 5 últimos (Más bajos), invertidos para ver el peor arriba
    };
  }

  //patron dias de la semana

  getSeasonality() {
    if (this.data.length === 0) return null;

    // Inicializamos acumuladores (0=Domingo, 1=Lunes, ..., 6=Sábado)
    const sums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    // Recorremos todos los datos
    this.data.forEach(row => {
      // row.dateObj ya es un objeto Date. getDay() devuelve 0-6.
      const dayIndex = row.dateObj.getDay();
      
      sums[dayIndex] += row.return;
      counts[dayIndex]++;
    });

    // Calculamos promedios
    // Si count es 0 (ej: fines de semana en bolsa tradicional), devolvemos 0
    const averages = sums.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0);

    return {
      averages: averages, // Array de 7 números
      counts: counts      // Cuántos días de cada uno hubo
    };
  }
// patron meses

  getMonthlySeasonality() {
    if (this.data.length === 0) return null;

    // Inicializamos acumuladores (0=Enero, 11=Diciembre)
    const sums = new Array(12).fill(0);
    const counts = new Array(12).fill(0);

    this.data.forEach(row => {
      // getMonth() devuelve 0 para Enero, 1 para Febrero...
      const monthIndex = row.dateObj.getMonth();
      
      sums[monthIndex] += row.return;
      counts[monthIndex]++;
    });

    // Calculamos promedios. Si no hay datos para un mes, devolvemos 0.
    const averages = sums.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0);

    return {
      averages: averages,
      counts: counts
    };
  }

// métodos rachas
  // REEMPLAZAR EN model.js

  getStreaksAnalysis() {
    if (this.data.length === 0) return null;

    let currentType = 0; 
    let currentCount = 0;
    let currentCumRet = 0;
    let currentStartDate = this.data[0].dateStr;

    let maxWinStreak = { count: 0, return: 0, start: '-', end: '-' };
    let maxLossStreak = { count: 0, return: 0, start: '-', end: '-' };
    let maxReturnStreak = { count: 0, return: -Infinity, start: '-', end: '-' };
    let maxDrawdownStreak = { count: 0, return: Infinity, start: '-', end: '-' };

    let history = [];

    this.data.forEach((row, i) => {
      const ret = row.return;
      const isPositive = ret >= 0;

      if (i > 0 && ((isPositive && currentType === 1) || (!isPositive && currentType === -1))) {
        // Continúa la racha
        currentCount++;
        currentCumRet = ((1 + currentCumRet) * (1 + ret)) - 1;
      
      } else {
        // CAMBIO DE RACHA
        if (i > 0) {
          const prevDate = this.data[i-1].dateStr;
          
          // NUEVO: Capturar el retorno del día siguiente (día actual 'row')
          // Como la racha terminó ayer (i-1), hoy (i) es el "día siguiente"
          const nextDayReturn = row.return; 

          history.push({
            type: currentType === 1 ? 'WIN' : 'LOSS',
            count: currentCount,
            return: currentCumRet,
            start: currentStartDate,
            end: prevDate,
            nextRet: nextDayReturn // Guardamos qué pasó después
          });

          // Récords (Igual que antes)
          if (currentType === 1) { 
            if (currentCount > maxWinStreak.count) maxWinStreak = { count: currentCount, return: currentCumRet, start: currentStartDate, end: prevDate };
            if (currentCumRet > maxReturnStreak.return) maxReturnStreak = { count: currentCount, return: currentCumRet, start: currentStartDate, end: prevDate };
          } else if (currentType === -1) { 
            if (currentCount > maxLossStreak.count) maxLossStreak = { count: currentCount, return: currentCumRet, start: currentStartDate, end: prevDate };
            if (currentCumRet < maxDrawdownStreak.return) maxDrawdownStreak = { count: currentCount, return: currentCumRet, start: currentStartDate, end: prevDate };
          }
        }

        // Iniciar nueva
        currentType = isPositive ? 1 : -1;
        currentCount = 1;
        currentCumRet = ret;
        currentStartDate = row.dateStr;
      }
    });

    return {
      longestWin: maxWinStreak,
      longestLoss: maxLossStreak,
      bestReturn: maxReturnStreak,
      worstReturn: maxDrawdownStreak,
      history: history.reverse()
    };
  }
  
//Calcula el ATR (Average True Range) para medir volatilidad     
    calculateATR(period = 14) {
        if (this.data.length === 0) return [];
        
        let trs = [];
        // 1. Calcular True Range (TR)
        for (let i = 1; i < this.data.length; i++) {
            const high = this.data[i].high;
            const low = this.data[i].low;
            const prevClose = this.data[i - 1].close;
            
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trs.push(tr);
        }

        // 2. Calcular Media Móvil del TR (ATR)
        let atrs = new Array(period).fill(null); // Relleno inicial
        for (let i = period; i < trs.length; i++) {
            const sum = trs.slice(i - period, i).reduce((a, b) => a + b, 0);
            atrs.push(sum / period);
        }
        return [null, ...atrs]; // Ajuste para alinear con el array de datos
    }

    /**
     * Lógica principal: Detecta impulsos y mide la corrección
     */
    runCorrectionAnalysis(atrPeriod = 14, impulseMultiplier = 2.0, lookForward = 5) {
        const atrs = this.calculateATR(atrPeriod);
        const events = [];

        // Empezamos después del periodo ATR y terminamos antes del margen de "futuro"
        for (let i = atrPeriod + 1; i < this.data.length - lookForward; i++) {
            const current = this.data[i];
            const currentATR = atrs[i];
            
            if (!currentATR) continue;

            const range = current.close - current.open; // Tamaño del cuerpo
            
            // CONDICIÓN: El cuerpo es X veces mayor al ATR (Movimiento fuerte)
            if (range > (currentATR * impulseMultiplier)) {
                
                // Analizar los siguientes días
                const impulseHigh = current.close;
                let minPrice = impulseHigh;
                let daysToLow = 0;

                for (let j = 1; j <= lookForward; j++) {
                    const futureCandle = this.data[i + j];
                    if (futureCandle.low < minPrice) {
                        minPrice = futureCandle.low;
                        daysToLow = j;
                    }
                }

                // Guardar métricas del evento
                events.push({
                    date: current.date,
                    impulseSize: (range / currentATR).toFixed(2) + "x ATR",
                    correctionDepthPct: (((impulseHigh - minPrice) / impulseHigh) * 100).toFixed(2),
                    correctionDepthATR: ((impulseHigh - minPrice) / currentATR).toFixed(2),
                    daysToBottom: daysToLow
                });
            }
        }

        // Calcular promedios para el resumen
        if (events.length > 0) {
            const avgDepth = events.reduce((sum, e) => sum + parseFloat(e.correctionDepthATR), 0) / events.length;
            const avgDays = events.reduce((sum, e) => sum + e.daysToBottom, 0) / events.length;
            
            this.analysisResults = {
                totalEvents: events.length,
                avgCorrectionATR: avgDepth.toFixed(2),
                avgDuration: avgDays.toFixed(1),
                details: events
            };
        } else {
            this.analysisResults = { error: "No se encontraron eventos con esos parámetros." };
        }

        return this.analysisResults;
    }

  
  getCSVContent() {
    let csv = 'Date,Open,High,Low,Close,Volume,Return(%)\n';
    this.data.forEach(row => {
      csv += `${row.dateStr},${row.open},${row.high},${row.low},${row.close},${row.volume},${row.returnPct.toFixed(2)}\n`;
    });
    return csv;
  }
}