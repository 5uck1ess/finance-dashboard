#!/bin/bash

# Create js directory if it doesn't exist
mkdir -p js

# Download Tailwind CSS Standalone
echo "Downloading Tailwind CSS Standalone..."
curl -sL "https://cdn.tailwindcss.com?plugins=typography" -o "js/tailwindcss.js"

if [ $? -eq 0 ]; then
    echo "✅ Tailwind CSS downloaded successfully to js/tailwindcss.js"
else
    echo "❌ Failed to download Tailwind CSS"
    exit 1
fi
