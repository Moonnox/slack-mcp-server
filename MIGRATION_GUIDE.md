# Migration Guide: Local to Remote MCP Server

This document explains the changes made to convert the Slack MCP server from a local (stdio-based) server to a fully remote HTTP-based server.

## Overview of Changes

The server has been transformed from requiring local environment variables to accepting credentials via HTTP headers, making it suitable for deployment as a remote service.

## Key Changes

### 1. **Transport Layer**

**Before (Local):**
- Supported both `stdio` and `http` transports
- Required command-line arguments: `--transport`, `--port`, `--token`
- Used MCP SDK's `StdioServerTransport` and `StreamableHTTPServerTransport`
- Managed sessions with session IDs

**After (Remote):**
- HTTP-only transport
- No command-line arguments needed
- Simple Express-based HTTP server
- Stateless - no session management
- Configuration via environment variables only

### 2. **Credential Management**

**Before (Local):**
```bash
# Environment variables required on server
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_TEAM_ID=T123...
export SLACK_CHANNEL_IDS=C123,C456  # optional
```

**After (Remote):**
```bash
# Credentials passed as HTTP headers with each request
curl -H "x-slack-bot-token: xoxb-..." \
     -H "x-slack-team-id: T123..." \
     -H "x-slack-channel-ids: C123,C456" \
     ...
```

### 3. **Authentication**

**Before (Local):**
- Optional Bearer token authentication via `--token` or `AUTH_TOKEN` env var
- Used `Authorization: Bearer <token>` header

**After (Remote):**
- Optional authentication via `SECRET_KEY` environment variable
- Uses `x-secret-key` header for authentication
- Can be disabled with `REQUIRE_AUTH=false`
- Only required for `tools/call`, not for discovery methods

### 4. **Configuration**

**Before (Local):**
```bash
# Command-line arguments
node index.js --transport http --port 8080 --token mytoken

# Environment variables
SLACK_BOT_TOKEN=xoxb-...
SLACK_TEAM_ID=T123...
AUTH_TOKEN=mytoken
```

**After (Remote):**
```bash
# Environment variables only
PORT=8080
HOST=0.0.0.0
SECRET_KEY=mytoken
REQUIRE_AUTH=true

# Slack credentials via headers (per-request)
```

### 5. **Code Architecture**

**Before (Local):**
- Used `@modelcontextprotocol/sdk` for server implementation
- `McpServer` class from SDK
- Tool registration via `server.registerTool()`
- Zod schemas for validation
- Session-based transport

**After (Remote):**
- Plain Express HTTP server
- Manual JSON-RPC 2.0 handling
- Tool definitions as plain objects
- No Zod dependency for tool definitions
- Stateless request handling

### 6. **SlackClient Changes**

**Before:**
```typescript
constructor(botToken: string)
// Got team_id from process.env.SLACK_TEAM_ID
// Got channel_ids from process.env.SLACK_CHANNEL_IDS
```

**After:**
```typescript
constructor(
  botToken: string,
  teamId: string,
  channelIds?: string
)
// All parameters passed explicitly
// New SlackClient instance per request
```

### 7. **Removed Functions**

The following functions were removed:
- `createSlackServer()` - No longer needed, tools defined as plain objects
- `runStdioServer()` - Stdio transport removed
- `runHttpServer()` - Replaced with simpler Express server
- `parseArgs()` - No command-line arguments needed
- Session management code

### 8. **New Features**

- **Discovery endpoints**: `/`, `/health`, `/tools` (GET)
- **Stateless operation**: Each request is independent
- **Header-based credentials**: More flexible for remote usage
- **Simpler deployment**: Just environment variables, no CLI args
- **Docker-ready**: Optimized for containerized deployment

## Migration Steps

### For Developers

1. **Update imports**: Remove `@modelcontextprotocol/sdk` and `zod` imports (they're still dependencies but not used directly)

2. **Update SlackClient instantiation**:
   ```typescript
   // Before
   const client = new SlackClient(process.env.SLACK_BOT_TOKEN);
   
   // After
   const client = new SlackClient(
     req.headers['x-slack-bot-token'],
     req.headers['x-slack-team-id'],
     req.headers['x-slack-channel-ids']
   );
   ```

3. **Update server startup**:
   ```bash
   # Before
   node dist/index.js --transport http --port 8080
   
   # After
   PORT=8080 node dist/index.js
   ```

### For Users/Clients

1. **Update configuration**:
   - Move Slack credentials from server environment variables to request headers
   - Update authentication to use `x-secret-key` header instead of `Authorization: Bearer`

2. **Update request format**:
   ```bash
   # Before (local)
   # Credentials configured on server
   curl -H "Authorization: Bearer token" \
        -X POST http://localhost:3000/mcp \
        -d '{"method": "tools/call", ...}'
   
   # After (remote)
   # Credentials per request
   curl -H "x-slack-bot-token: xoxb-..." \
        -H "x-slack-team-id: T123..." \
        -H "x-secret-key: secret" \
        -X POST http://localhost:8080/mcp \
        -d '{"method": "tools/call", ...}'
   ```

3. **Update deployment**:
   - Use Docker or container orchestration
   - Set only `PORT`, `HOST`, `SECRET_KEY`, `REQUIRE_AUTH` as environment variables
   - Pass Slack credentials via headers from client
   - Use HTTPS in production to protect credentials in headers

### For CI/CD

1. **Update Docker build**:
   ```bash
   # No changes needed to Dockerfile
   docker build -t slack-mcp-server .
   ```

2. **Update Docker run**:
   ```bash
   # Before
   docker run -e SLACK_BOT_TOKEN=xoxb-... \
              -e SLACK_TEAM_ID=T123... \
              -p 3000:3000 slack-mcp-server
   
   # After
   docker run -e PORT=8080 \
              -e SECRET_KEY=mysecret \
              -p 8080:8080 slack-mcp-server
   ```

3. **Update Kubernetes/Cloud Run configs**:
   - Remove Slack credential secrets from deployment
   - Add only `SECRET_KEY` as a secret
   - Update client code to pass credentials

## Backward Compatibility

⚠️ **Breaking Changes**: This is a major architectural change with NO backward compatibility:

- Stdio transport is removed
- Command-line arguments are removed
- Environment variables for Slack credentials are no longer used
- Authentication mechanism changed
- Session management removed

## Testing

### Test the health endpoint:
```bash
curl http://localhost:8080/health
```

### Test tool execution:
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "x-slack-bot-token: xoxb-your-token" \
  -H "x-slack-team-id: T1234567890" \
  -H "x-secret-key: your-secret" \
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

### Use example clients:
```bash
# Bash client
./example-client.sh

# Python client
python3 example-client.py
```

## Advantages of Remote Architecture

1. **Scalability**: Deploy multiple instances behind a load balancer
2. **Security**: Credentials not stored on server
3. **Multi-tenancy**: Multiple clients with different Slack workspaces
4. **Flexibility**: Clients can switch workspaces per request
5. **Simplicity**: No session management, stateless requests
6. **Cloud-native**: Perfect for serverless and container platforms

## Rollback Plan

If you need to rollback to the local version:

1. Check out the previous git commit before migration
2. Restore the original `index.ts` file
3. Rebuild: `npm run build`
4. Run with: `node dist/index.js --transport http`

## Support

For questions or issues with the migration:
- Open a GitHub issue
- Check the README.md for usage examples
- Review example-client.sh and example-client.py

## Future Enhancements

Potential improvements for future versions:
- Rate limiting per client
- OAuth-based authentication
- Request logging and metrics
- WebSocket support for real-time updates
- Caching layer for frequently accessed data
- Multi-region deployment support

