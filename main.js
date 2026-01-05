// main.js
import TradingModel from './model.js';
import TradingView from './view.js';
import TradingController from './controller.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = new TradingController(new TradingModel(), new TradingView());
  console.log("App MVC Iniciada y separada en módulos 🚀");
});