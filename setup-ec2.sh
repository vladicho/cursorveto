#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-ec2.sh — Setup inicial do MoldeLab no EC2 (rodar 1x)
#
# Uso (via SSH no EC2):
#   chmod +x setup-ec2.sh
#   ./setup-ec2.sh
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/home/ubuntu/cursorveto"
SERVICE_NAME="moldelab"

echo "═══════════════════════════════════════════════"
echo "  MoldeLab — Setup EC2 (primeira vez)"
echo "═══════════════════════════════════════════════"

# ── 1. Instalar Node.js 22 ──────────────────────────────────────────────────
echo ""
echo "► Verificando Node.js..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  echo "  Instalando Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "  Node.js $(node -v) já instalado."
fi

# ── 2. Instalar PM2 ─────────────────────────────────────────────────────────
echo ""
echo "► Verificando PM2..."
if ! command -v pm2 &>/dev/null; then
  echo "  Instalando PM2..."
  sudo npm install -g pm2
  pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash || true
else
  echo "  PM2 já instalado."
fi

# ── 3. Instalar cloudflared ─────────────────────────────────────────────────
echo ""
echo "► Verificando cloudflared..."
if ! command -v cloudflared &>/dev/null; then
  echo "  Instalando cloudflared..."
  if [ -f "$APP_DIR/cloudflared.deb" ]; then
    sudo dpkg -i "$APP_DIR/cloudflared.deb"
  else
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb
  fi
else
  echo "  cloudflared já instalado."
fi

# ── 4. Clonar repo (se não existir) ─────────────────────────────────────────
echo ""
if [ ! -d "$APP_DIR" ]; then
  echo "► Clonando repositório..."
  git clone https://github.com/vladicho/cursorveto.git "$APP_DIR"
else
  echo "► Repositório já existe em $APP_DIR"
fi

# ── 5. Instalar dependências ────────────────────────────────────────────────
echo ""
echo "► Instalando dependências..."
cd "$APP_DIR"
npm install --production

# ── 6. Build ─────────────────────────────────────────────────────────────────
echo ""
echo "► Build do frontend..."
npm run build

# ── 7. Criar .env a partir do exemplo (se não existir) ──────────────────────
echo ""
if [ ! -f "$APP_DIR/.env" ]; then
  echo "► Criando .env a partir do .env.example..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "  ⚠ EDITE o arquivo .env com suas credenciais:"
  echo "    nano $APP_DIR/.env"
else
  echo "► .env já existe."
fi

# ── 8. Criar serviço systemd ────────────────────────────────────────────────
echo ""
echo "► Configurando serviço systemd..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=MoldeLab Web Editor
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$(which node) scanner-server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
echo "  Serviço systemd criado e habilitado."

# ── 9. Criar serviço systemd para cloudflared ────────────────────────────────
echo ""
echo "► Configurando tunnel cloudflared..."
sudo tee /etc/systemd/system/moldelab-tunnel.service > /dev/null <<EOF
[Unit]
Description=MoldeLab Cloudflare Tunnel (HTTPS)
After=network.target $SERVICE_NAME.service

[Service]
Type=simple
User=ubuntu
ExecStart=$(which cloudflared) tunnel --url http://localhost:8787 --no-autoupdate
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable moldelab-tunnel
echo "  Serviço cloudflared criado e habilitado."

# ── 10. Resumo ───────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Setup concluído!"
echo ""
echo "  Próximos passos:"
echo "  1. Edite as credenciais:"
echo "     nano $APP_DIR/.env"
echo ""
echo "  2. Inicie o servidor:"
echo "     sudo systemctl start $SERVICE_NAME"
echo ""
echo "  3. Inicie o tunnel HTTPS:"
echo "     sudo systemctl start moldelab-tunnel"
echo ""
echo "  4. Veja a URL HTTPS do tunnel:"
echo "     journalctl -u moldelab-tunnel -f"
echo "     (procure por 'https://...trycloudflare.com')"
echo ""
echo "  5. Configure a URL HTTPS no Meta for Developers:"
echo "     Webhook URL: https://SEU-TUNNEL.trycloudflare.com/webhook/whatsapp"
echo "     Verify Token: moldelab_verify_2024"
echo "═══════════════════════════════════════════════"
