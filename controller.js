// controller.js
export default class TradingController {
  constructor(model, view) {
    this.model = model;
    this.view = view;

    // Enlazar eventos de la vista con métodos del controlador
    this.view.bindVisualize(this.handleVisualize.bind(this));
    this.view.bindDownload(this.handleDownload.bind(this));
  }

  async handleVisualize() {
    const params = this.view.getFormData();
    
    if (!params.symbol || !params.dateFrom || !params.dateTo) {
      this.view.showError("Por favor completa todos los campos.");
      return;
    }

    try {
      this.view.toggleLoading(true);

      // 1. Pedir datos
      const data = await this.model.fetchData(
        params.symbol, 
        params.interval, 
        params.dateFrom, 
        params.dateTo
      );

      // 2. Pedir estadísticas
      const stats = this.model.getStatistics();
      
      // 3. NUEVO: Pedir extremos (Top 5)
      const extremes = this.model.getExtremes();

      // NUEVO: Calcular Patrones
      const seasonality = this.model.getSeasonality();

      // 4. Actualizar la Vista (pasamos ambos objetos)
      this.view.showResultsPanel();
      
      // ¡Aquí está el cambio clave! Pasamos stats Y extremes
      this.view.renderStatistics(stats, extremes); 
      
      this.view.renderChart(data, params.symbol);
      this.view.renderHistoricalTable(data);
      // NUEVO: Renderizar gráfico de patrones
      this.view.renderSeasonalityChart(seasonality);

    } catch (error) {
      console.error(error);
      this.view.showError(error.message);
    } finally {
      this.view.toggleLoading(false);
    }
  }

  async handleDownload() {
    if (this.model.data.length === 0) {
      const confirmFetch = confirm("No hay datos cargados. ¿Deseas descargarlos ahora?");
      if (confirmFetch) {
        await this.handleVisualize();
        if (this.model.data.length === 0) return;
      } else {
        return;
      }
    }

    const csvContent = this.model.getCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.model.symbol}_${this.model.interval}_data.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}