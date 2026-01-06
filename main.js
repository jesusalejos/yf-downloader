import TradingModel from './model.js';
import TradingView from './view.js';
import TradingController from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
  const model = new TradingModel();
  const view = new TradingView();
  const app = new TradingController(model, view);
  
  console.log("Trading Lab v2.0 (MVC + Volatility Analysis) Iniciado 🚀");
});