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
// En model.js, agrega este método a la clase:

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

  getCSVContent() {
    let csv = 'Date,Open,High,Low,Close,Volume,Return(%)\n';
    this.data.forEach(row => {
      csv += `${row.dateStr},${row.open},${row.high},${row.low},${row.close},${row.volume},${row.returnPct.toFixed(2)}\n`;
    });
    return csv;
  }
}