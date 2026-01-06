export default class TradingController {
  constructor(model, view) {
    this.model = model;
    this.view = view;

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

      // 1. Fetch Data
      const data = await this.model.fetchData(
        params.symbol, 
        params.interval, 
        params.dateFrom, 
        params.dateTo
      );

      // 2. Calculate Basic Statistics
      const stats = this.model.getStatistics();
      const extremes = this.model.getExtremes();

      // 3. Calculate Patterns
      const seasonality = this.model.getSeasonality();
      const monthlySeasonality = this.model.getMonthlySeasonality();
      const streaks = this.model.getStreaksAnalysis();

      // 4. NEW: Calculate Shock & Correction (ATR 14, Shock 2.0x, 5 days look-forward)
      const correctionReport = this.model.runCorrectionAnalysis(14, 2.0, 5);

      // 5. Render View
      this.view.showResultsPanel();
      
      this.view.renderStatistics(stats, extremes); 
      this.view.renderChart(data, params.symbol);
      this.view.renderHistoricalTable(data);
      
      this.view.renderSeasonalityChart(seasonality);
      this.view.renderMonthlyChart(monthlySeasonality);
      this.view.renderStreaks(streaks);
      
      // Render new report
      this.view.renderCorrectionAnalysis(correctionReport);

    } catch (error) {
      console.error(error);
      this.view.showError(error.message);
    } finally {
      this.view.toggleLoading(false);
    }
  }

  async handleDownload() {
    if (this.model.data.length === 0) {
      this.view.showError("Primero visualiza los datos para poder descargarlos.");
      return;
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