#!/bin/bash

# Example client script for Slack MCP Server
# This script demonstrates how to interact with the remote MCP server

# Configuration
SERVER_URL="${SERVER_URL:-http://localhost:8080}"
SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}"
SLACK_TEAM_ID="${SLACK_TEAM_ID}"
SECRET_KEY="${SECRET_KEY}"
CHANNEL_ID="${CHANNEL_ID}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}==>${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_warning "jq is not installed. Output will not be formatted."
    JQ_AVAILABLE=false
else
    JQ_AVAILABLE=true
fi

# Format JSON output if jq is available
format_output() {
    if [ "$JQ_AVAILABLE" = true ]; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

# Test 1: Health Check
print_step "Testing health check endpoint..."
RESPONSE=$(curl -s "${SERVER_URL}/health")
format_output "$RESPONSE"
echo ""

# Test 2: Server Information
print_step "Getting server information..."
RESPONSE=$(curl -s "${SERVER_URL}/")
format_output "$RESPONSE"
echo ""

# Test 3: Initialize Connection
print_step "Initializing MCP connection..."
RESPONSE=$(curl -s -X POST "${SERVER_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "example-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }')
format_output "$RESPONSE"
echo ""

# Test 4: List Tools
print_step "Listing available tools..."
RESPONSE=$(curl -s -X POST "${SERVER_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }')
format_output "$RESPONSE"
echo ""

# Test 5: List Channels (requires credentials)
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_TEAM_ID" ]; then
    print_warning "Skipping tool execution tests. Set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables to test."
else
    print_step "Listing Slack channels..."
    
    HEADERS=(-H "Content-Type: application/json")
    HEADERS+=(-H "x-slack-bot-token: ${SLACK_BOT_TOKEN}")
    HEADERS+=(-H "x-slack-team-id: ${SLACK_TEAM_ID}")
    
    if [ -n "$SECRET_KEY" ]; then
        HEADERS+=(-H "x-secret-key: ${SECRET_KEY}")
    fi
    
    RESPONSE=$(curl -s -X POST "${SERVER_URL}/mcp" \
      "${HEADERS[@]}" \
      -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
          "name": "slack_list_channels",
          "arguments": {
            "limit": 10
          }
        },
        "id": 3
      }')
    format_output "$RESPONSE"
    echo ""
    
    # Test 6: Post a Message (if channel ID is provided)
    if [ -n "$CHANNEL_ID" ]; then
        print_step "Posting a test message..."
        
        RESPONSE=$(curl -s -X POST "${SERVER_URL}/mcp" \
          "${HEADERS[@]}" \
          -d "{
            \"jsonrpc\": \"2.0\",
            \"method\": \"tools/call\",
            \"params\": {
              \"name\": \"slack_post_message\",
              \"arguments\": {
                \"channel_id\": \"${CHANNEL_ID}\",
                \"text\": \"Test message from MCP client at $(date)\"
              }
            },
            \"id\": 4
          }")
        format_output "$RESPONSE"
        echo ""
    else
        print_warning "Skipping message post test. Set CHANNEL_ID environment variable to test."
    fi
fi

print_step "Tests completed!"

