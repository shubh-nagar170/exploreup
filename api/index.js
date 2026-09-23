// Vercel Serverless Function entry point for ExploreUP Express app
const app = require('../server.js');

module.exports = (req, res) => {
  // Normalize req.url to ensure /api prefix is present when routed by Vercel rewrites
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
