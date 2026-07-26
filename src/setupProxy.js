const { createProxyMiddleware } = require("http-proxy-middleware");

// Dev-only proxy rules (substitui o antigo package.json "proxy": single-string,
// que era um catch-all impreciso). Cada regra é explícita e isolada por prefixo de path:
//   /api/vault      -> vault_server.py       (:8766) — comportamento já existente, preservado
//   /api/portfolio  -> portfolio_api_server.py (:8767) — novo, seção /system
//   /api/termux     -> termux_api_server.py  (:8768) — sync Liquid + saúde do S22
module.exports = function (app) {
  app.use(
    "/api/vault",
    createProxyMiddleware({
      target: process.env.VAULT_API_PROXY_TARGET || "http://127.0.0.1:8766",
      changeOrigin: true,
    })
  );

  app.use(
    "/api/portfolio",
    createProxyMiddleware({
      target: process.env.PORTFOLIO_API_PROXY_TARGET || "http://127.0.0.1:8767",
      changeOrigin: true,
    })
  );

  app.use(
    "/api/termux",
    createProxyMiddleware({
      target: process.env.TERMUX_API_PROXY_TARGET || "http://127.0.0.1:8768",
      changeOrigin: true,
    })
  );
};
