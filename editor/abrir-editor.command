#!/bin/bash
cd "$(dirname "$0")"

# Verifica se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Inicia o servidor
echo "🚀 Abrindo editor..."
node server.js