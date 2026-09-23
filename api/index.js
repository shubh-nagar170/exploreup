// Vercel Serverless Function entry point for ExploreUP Express app
const app = require('../server.js');

module.exports = (req, res) => {
  // If rewrite stripped the /api prefix for known API routes, restore it
  const knownApiRoutes = ['/chat', '/login', '/logout', '/me', '/register'];
  const pathname = (req.url || '').split('?')[0];

  if (knownApiRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    req.url = '/api' + req.url;
  }

  return app(req, res);
};
