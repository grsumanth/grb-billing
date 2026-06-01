// Dynamic configuration for local vs. production environment
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://grb-billing.onrender.com';
