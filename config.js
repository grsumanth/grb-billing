// Dynamic configuration for local vs. production environment
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '' // Served by local backend
  : window.location.protocol === 'file:'
    ? 'http://localhost:5000' // Double-clicked locally
    : 'https://grb-billing.onrender.com'; // Production Render API
