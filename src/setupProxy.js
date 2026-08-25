const { createProxyMiddleware } = require("http-proxy-middleware");

// Dev-only proxy rules (substitui o antigo package.json "proxy": single-string,
// que era um catch-all impreciso). Cada regra é explícita e isolada por prefixo de path:
//   /api/vault       -> vault_server.py        (:8766)
//   /api/portfolio   -> portfolio_api_server.py (:8767)
//   /api/termux      -> termux_api_server.py   (:8768)
//   /api/analyses/*    -> tools/analyses serve_live.py (:8769) — opcional
//   /api/liquid-pots   -> liquid_pots_server.py (:8770) — potes + Telegram
//
// Analyses e Liquid TX estáticos ficam em public/tools/* (via scripts/sync-dealer-tools.sh).

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

  // Opcional: python3 tools/analyses/scripts/serve_live.py
  const analysesTarget =
    process.env.ANALYSES_API_PROXY_TARGET || "http://127.0.0.1:8769";
  app.use(
    "/api/analyses",
    createProxyMiddleware({
      target: analysesTarget,
      changeOrigin: true,
      pathRewrite: {
        "^/api/analyses/live": "/api/live",
        "^/api/analyses/recompute": "/api/recompute",
        "^/api/analyses/formulas": "/api/formulas",
        "^/api/analyses": "",
      },
      onError: (err, _req, res) => {
        // Sem serve_live.py o dashboard usa public/tools/analyses/live.json
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: "analyses API offline", detail: String(err.message || err) }));
      },
    })
  );

  app.use(
    "/api/liquid-pots",
    createProxyMiddleware({
      target: process.env.LIQUID_POTS_PROXY_TARGET || "http://127.0.0.1:8770",
      changeOrigin: true,
      onError: (err, _req, res) => {
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
        }
        res.end(
          JSON.stringify({
            error: "liquid-pots API offline",
            detail: String(err.message || err),
          })
        );
      },
    })
  );
};
