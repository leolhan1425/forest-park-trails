#!/bin/bash
set -e

echo "Building for production..."
npx vite build

echo "Deploying frontend..."
rsync -avz --delete dist/ root@89.167.19.159:/opt/forest-park-trails/dist/

echo "Deploying server..."
rsync -avz server/ root@89.167.19.159:/opt/forest-park-trails/server/

echo "Deploying data..."
rsync -avz public/data/ root@89.167.19.159:/opt/forest-park-trails/dist/data/

echo "Installing server dependencies & restarting..."
ssh root@89.167.19.159 "cd /opt/forest-park-trails/server && npm install --omit=dev && systemctl restart forest-park-trails"

echo "Done! https://trails.hanlabnw.com"
