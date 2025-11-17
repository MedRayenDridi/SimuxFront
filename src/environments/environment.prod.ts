export const environment = {
  production: true,
  apiBaseUrl: 'https://api.tradesim.com',
  wsUrl: '',
  enableWebSocket: false,
  apiTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  marketDataConfig: {
    baseUrl: 'https://api.tradesim.com',
    chartEndpoint: '/coins',
    defaultSymbol: 'btc',
    defaultInterval: '1h',
    candleLimit: 500,
    pollIntervalMs: 15000
  }
};
