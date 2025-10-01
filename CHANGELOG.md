# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - Remote MCP Server - 2024-10-01

### 🚀 Major Changes

Complete architectural transformation from local stdio-based MCP server to remote HTTP-based MCP server.

### ✨ Added

- **HTTP-only transport** with stateless request handling
- **Header-based credential system** for Slack authentication
  - `x-slack-bot-token` - Slack bot token
  - `x-slack-team-id` - Slack workspace ID  
  - `x-slack-channel-ids` - Optional channel IDs
  - `x-secret-key` - Server authentication
- **New HTTP endpoints**:
  - `GET /` - Server information
  - `GET /health` - Health check
  - `GET /tools` - List available tools
  - `POST /mcp` - Main MCP JSON-RPC endpoint
- **Authentication middleware** with configurable `REQUIRE_AUTH` and `SECRET_KEY`
- **Environment variable configuration**:
  - `PORT` - Server port (default: 8080)
  - `HOST` - Server host (default: 0.0.0.0)
  - `SECRET_KEY` - Authentication secret
  - `REQUIRE_AUTH` - Enable/disable auth (default: true)
- **Docker support**:
  - Updated Dockerfile with EXPOSE directive
  - docker-compose.yml for easy local testing
- **Example clients**:
  - `example-client.sh` - Bash/curl examples
  - `example-client.py` - Python client library with examples
- **Documentation**:
  - Comprehensive README.md with usage examples
  - MIGRATION_GUIDE.md for upgrading from v1.x
  - CHANGELOG.md (this file)

### 🔄 Changed

- **SlackClient constructor** now accepts `teamId` and `channelIds` as parameters
- **Server initialization** simplified - no command-line arguments needed
- **MCP protocol implementation** changed from SDK-based to manual JSON-RPC handling
- **Tool definitions** converted from Zod schemas to plain JSON Schema objects
- **Error handling** improved with better error messages

### ❌ Removed

- **Stdio transport** - Only HTTP is supported now
- **Command-line arguments** (`--transport`, `--port`, `--token`)
- **Session management** - Server is now stateless
- **Functions removed**:
  - `createSlackServer()`
  - `runStdioServer()`
  - `runHttpServer()` (replaced with simpler implementation)
  - `parseArgs()`
- **Environment variables removed** (from server):
  - `SLACK_BOT_TOKEN` - Now passed via header
  - `SLACK_TEAM_ID` - Now passed via header
  - `SLACK_CHANNEL_IDS` - Now passed via header
  - `AUTH_TOKEN` - Replaced with `SECRET_KEY`

### 🐛 Fixed

- Updated tests to match new architecture
- Fixed TypeScript types for Express handlers

### 🔒 Security

- Credentials no longer stored on server (passed per-request)
- Configurable authentication with `SECRET_KEY`
- Authentication can be disabled for development with `REQUIRE_AUTH=false`
- Discovery methods (`initialize`, `tools/list`) don't require authentication

### 📦 Dependencies

No changes to package.json dependencies, but usage changed:
- `@modelcontextprotocol/sdk` - Still a dependency but used differently
- `express` - Now the primary HTTP framework
- `zod` - Still a dependency but not used for tool schemas

### ⚠️ Breaking Changes

This is a MAJOR version update with complete architectural changes:

1. **No backward compatibility** with v1.x
2. **Stdio transport removed** - HTTP only
3. **Authentication mechanism changed** - Use `x-secret-key` header
4. **Credential management changed** - Pass via headers, not env vars
5. **API endpoints changed** - New stateless JSON-RPC interface
6. **Session management removed** - All requests are independent

### 🚧 Migration Required

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions.

### 📝 Usage Example

```bash
# Start server
PORT=8080 SECRET_KEY=mysecret npm start

# Make request
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "x-slack-bot-token: xoxb-..." \
  -H "x-slack-team-id: T123..." \
  -H "x-secret-key: mysecret" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_list_channels",
      "arguments": {"limit": 10}
    },
    "id": 1
  }'
```

### 🎯 Design Goals

The v2.0 architecture focuses on:
- **Scalability**: Stateless design for horizontal scaling
- **Security**: Per-request credentials, no server-side storage
- **Simplicity**: Simple HTTP server, no complex session management
- **Flexibility**: Multi-tenant capable, workspace per request
- **Cloud-native**: Perfect for containers, serverless, Kubernetes

### 🙏 Credits

Based on the MCP video screenshots server Python implementation pattern.

---

## [1.x.x] - Local MCP Server (Previous Versions)

Previous versions supported stdio and HTTP transports with local configuration.
See git history for details on v1.x releases.

