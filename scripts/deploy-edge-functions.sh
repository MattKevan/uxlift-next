#!/bin/bash

# Script to deploy Supabase Edge Functions
# This script will apply the database migrations and deploy the edge functions

# Exit on error
set -e

echo "Deploying Supabase Edge Functions..."

# Check if config.toml exists with per_worker policy
if [ -f "supabase/config.toml" ]; then
  echo "Verifying edge_runtime configuration..."
  if ! grep -q "policy = \"per_worker\"" supabase/config.toml; then
    echo "Adding per_worker policy to config.toml..."
    echo -e "\n[edge_runtime]\npolicy = \"per_worker\"" >> supabase/config.toml
  else
    echo "per_worker policy already configured."
  fi
else
  echo "Creating config.toml with per_worker policy..."
  mkdir -p supabase
  echo -e "[edge_runtime]\npolicy = \"per_worker\"" > supabase/config.toml
fi

# Apply database migrations
echo "Applying database migrations..."
supabase db push

# Deploy shared modules
echo "Deploying shared modules..."
supabase functions deploy _shared

# Deploy controller function
echo "Deploying process-feeds-controller function..."
supabase functions deploy process-feeds-controller

# Deploy worker function
echo "Deploying process-feeds-worker function..."
supabase functions deploy process-feeds-worker

# Set up scheduled execution (every hour)
echo "Setting up scheduled execution..."
supabase functions schedule create process-feeds-hourly \
  --function process-feeds-controller \
  --schedule "0 * * * *" \
  --body '{"isCron": true}'

# Set environment variables
echo "Setting environment variables..."

# Check if .env file exists
if [ -f "./supabase/functions/.env" ]; then
  echo "Found .env file, setting secrets from file..."
  supabase secrets set --env-file ./supabase/functions/.env
else
  # Check if environment variables are set
  if [ -z "$OPENAI_API_KEY" ] || [ -z "$PINECONE_API_KEY" ] || [ -z "$PINECONE_INDEX_NAME" ]; then
    echo "Warning: Some required environment variables are not set."
    echo "Please set OPENAI_API_KEY, PINECONE_API_KEY, and PINECONE_INDEX_NAME"
    echo "You can create a .env file in supabase/functions/ or set them in your environment."
    
    # Prompt for values if not set
    if [ -z "$OPENAI_API_KEY" ]; then
      read -p "Enter your OpenAI API key: " OPENAI_API_KEY
    fi
    
    if [ -z "$PINECONE_API_KEY" ]; then
      read -p "Enter your Pinecone API key: " PINECONE_API_KEY
    fi
    
    if [ -z "$PINECONE_INDEX_NAME" ]; then
      read -p "Enter your Pinecone index name: " PINECONE_INDEX_NAME
    fi
  fi
  
  echo "Setting individual secrets..."
  supabase secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
  supabase secrets set PINECONE_API_KEY="$PINECONE_API_KEY"
  supabase secrets set PINECONE_INDEX_NAME="$PINECONE_INDEX_NAME"
fi

# List all secrets to verify
echo "Listing configured secrets:"
supabase secrets list

echo "Deployment completed successfully!"
echo "You can now access the activity logs in the admin dashboard at /admin/activity-logs"
echo "Note: With per_worker policy, functions won't auto-reload on edits during development."
echo "You'll need to manually restart them by running 'supabase functions serve'."