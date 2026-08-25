# Subprojetos embutidos no hub /dealer (Analyses + Liquid TX)
#
# Fonte:     tools/analyses , tools/liquid-txs
# Publicado: public/tools/*  ← npm run sync:tools
#
# Após editar a fonte, rode sync de novo (também roda no prebuild).
#
# Potes / Telegram (Liquid TX):
#   Mensageria única: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID no .env
#   (mesmo bot do manager_dealer / Dealer → Configurações → Telegram)
#   npm run start:liquid-pots   → :8770
#   Deploy: passo 4 de deploy-production.sh

node_modules/
