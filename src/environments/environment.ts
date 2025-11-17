export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8090',
  wsUrl: '',
  enableWebSocket: false,
  apiTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  marketDataConfig: {
    baseUrl: 'http://localhost:8090',
    chartEndpoint: '/coins',
    defaultSymbol: 'btc',
    defaultInterval: '1h',
    candleLimit: 500,
    pollIntervalMs: 15000
  }
};
