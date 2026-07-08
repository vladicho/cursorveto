#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy-ec2.sh — Script de deploy do MoldeLab no EC2
#
# Uso:
#   chmod +x deploy-ec2.sh
#   ./deploy-ec2.sh
#
# Pré-requisitos:
#   1. Arquivo .env configurado na raiz do projeto no servidor
#   2. Node.js >= 18 instalado no EC2
#   3. Git configurado para puxar o repo
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/home/ubuntu/cursorveto"
SERVICE_NAME="moldelab"

echo "═══════════════════════════════════════════════"
echo "  MoldeLab — Deploy EC2"
echo "═══════════════════════════════════════════════"

# ── 1. Atualizar código ─────────────────────────────────────────────────────
echo ""
echo "► Atualizando código..."
cd "$APP_DIR"
git pull --ff-only origin main

# ── 2. Instalar dependências ────────────────────────────────────────────────
echo ""
echo "► Instalando dependências..."
npm install --production

# ── 3. Build do frontend ────────────────────────────────────────────────────
echo ""
echo "► Build do frontend..."
npm run build

# ── 4. Reiniciar serviço ────────────────────────────────────────────────────
echo ""
echo "► Reiniciando serviço..."
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  sudo systemctl restart "$SERVICE_NAME"
  echo "  Serviço $SERVICE_NAME reiniciado."
else
  echo "  Serviço systemd não encontrado. Iniciando com PM2..."
  if command -v pm2 &>/dev/null; then
    pm2 stop "$SERVICE_NAME" 2>/dev/null || true
    pm2 start scanner-server.js --name "$SERVICE_NAME" --env production
    pm2 save
    echo "  PM2 iniciado."
  else
    echo "  PM2 não instalado. Iniciando diretamente..."
    echo "  Execute: node scanner-server.js"
    echo "  Ou instale PM2: npm install -g pm2"
  fi
fi

# ── 5. Verificar saúde ──────────────────────────────────────────────────────
echo ""
echo "► Verificando saúde..."
sleep 2
if curl -sf http://localhost:8787/health >/dev/null 2>&1; then
  echo "  ✓ Servidor respondendo em http://localhost:8787"
else
  echo "  ✗ Servidor não respondeu. Verifique os logs."
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Deploy concluído!"
echo ""
echo "  Servidor: http://52.14.90.135:8787"
echo ""
echo "  Para HTTPS (necessário para WhatsApp webhook):"
echo "    cloudflared tunnel --url http://localhost:8787"
echo "═══════════════════════════════════════════════"
