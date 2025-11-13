#!/usr/bin/env bash
set -ex

# Instala las dependencias
npm install

# Reconstruye sqlite3 desde el código fuente para Render
npm rebuild sqlite3 --build-from-source