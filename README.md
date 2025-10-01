# Slack MCP Server (Remote)

A remote Model Context Protocol (MCP) server that exposes Slack functionality via HTTP. This server accepts Slack credentials as HTTP headers, making it fully remote and suitable for deployment as a service.

## Features

- **Remote Access**: Accept Slack credentials via HTTP headers instead of environment variables
- **MCP Protocol Compliant**: Implements MCP 2024-11-05 specification
- **JSON-RPC 2.0**: Standard JSON-RPC interface
- **Authentication**: Optional authentication via secret key
- **Docker Ready**: Includes Dockerfile for easy deployment

## Available Tools

1. **slack_list_channels** - List public and private channels
2. **slack_post_message** - Post a message to a channel
3. **slack_reply_to_thread** - Reply to a message thread
4. **slack_add_reaction** - Add emoji reaction to a message
5. **slack_get_channel_history** - Get recent messages from a channel
6. **slack_get_thread_replies** - Get all replies in a thread
7. **slack_get_users** - Get list of workspace users
8. **slack_get_user_profile** - Get detailed user profile information

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | `8080` | No |
| `HOST` | HTTP server host | `0.0.0.0` | No |
| `SECRET_KEY` | Authentication secret for tool execution | `""` | No |
| `REQUIRE_AUTH` | Enable authentication middleware | `true` | No |

### HTTP Headers (Per-Request)

These headers must be provided with each request to authenticate with Slack:

| Header | Description | Required |
|--------|-------------|----------|
| `x-slack-bot-token` | Slack bot token (xoxb-...) | Yes (for tools/call) |
| `x-slack-team-id` | Slack team/workspace ID | Yes (for tools/call) |
| `x-slack-channel-ids` | Comma-separated list of channel IDs | No |
| `x-secret-key` | Server authentication secret | Yes (if REQUIRE_AUTH=true and SECRET_KEY is set) |

## Installation

### Using npm

```bash
npm install
npm run build
```

### Using Docker

```bash
docker build -t slack-mcp-server .
docker run -p 8080:8080 \
  -e SECRET_KEY=your-secret-key \
  -e REQUIRE_AUTH=true \
  slack-mcp-server
```

## Usage

### Starting the Server

```bash
# Using npm
npm start

# Using node directly
node dist/index.js

# With custom environment variables
PORT=3000 SECRET_KEY=mysecret npm start
```

### Making Requests

#### 1. Initialize Connection

```bash
curl -X POST http://localhost:8080/mcp \
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
  }'
```

#### 2. List Available Tools

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }'
```

#### 3. Execute a Tool

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "x-slack-bot-token: xoxb-your-bot-token" \
  -H "x-slack-team-id: T1234567890" \
  -H "x-secret-key: your-secret-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_list_channels",
      "arguments": {
        "limit": 50
      }
    },
    "id": 3
  }'
```

#### 4. Post a Message

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "x-slack-bot-token: xoxb-your-bot-token" \
  -H "x-slack-team-id: T1234567890" \
  -H "x-secret-key: your-secret-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_post_message",
      "arguments": {
        "channel_id": "C1234567890",
        "text": "Hello from MCP!"
      }
    },
    "id": 4
  }'
```

### Other Endpoints

#### Health Check

```bash
curl http://localhost:8080/health
```

Returns:
```json
{
  "status": "healthy",
  "service": "mcp-slack-server"
}
```

#### Server Information

```bash
curl http://localhost:8080/
```

Returns server information and available endpoints.

#### List Tools (GET)

```bash
curl http://localhost:8080/tools
```

Returns the list of available tools without requiring authentication.

## Authentication

The server supports two levels of authentication:

### 1. Discovery (No Authentication Required)

These methods can be called without authentication:
- `initialize`
- `tools/list`
- GET `/tools`
- GET `/health`

### 2. Tool Execution (Authentication Required)

When `REQUIRE_AUTH=true` and `SECRET_KEY` is set:
- The `x-secret-key` header must match the `SECRET_KEY` environment variable
- Slack credentials (`x-slack-bot-token`, `x-slack-team-id`) are always required for tool execution

## Deployment

### Cloud Run (Google Cloud)

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/slack-mcp-server

# Deploy to Cloud Run
gcloud run deploy slack-mcp-server \
  --image gcr.io/YOUR_PROJECT_ID/slack-mcp-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars SECRET_KEY=your-secret-key,REQUIRE_AUTH=true
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: slack-mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: slack-mcp-server
  template:
    metadata:
      labels:
        app: slack-mcp-server
    spec:
      containers:
      - name: slack-mcp-server
        image: slack-mcp-server:latest
        ports:
        - containerPort: 8080
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: slack-mcp-secret
              key: secret-key
        - name: REQUIRE_AUTH
          value: "true"
---
apiVersion: v1
kind: Service
metadata:
  name: slack-mcp-server
spec:
  selector:
    app: slack-mcp-server
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
```

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint  # if configured
```

## Security Considerations

1. **Always use HTTPS in production** to protect Slack tokens in headers
2. **Set a strong SECRET_KEY** when deploying publicly
3. **Enable REQUIRE_AUTH** in production environments
4. **Rotate SECRET_KEY** regularly
5. **Use environment-specific secrets** for different deployments
6. **Monitor access logs** for suspicious activity

## MCP Protocol Compliance

This server implements the Model Context Protocol (MCP) 2024-11-05 specification:

- ✅ JSON-RPC 2.0 transport
- ✅ Standard MCP methods (initialize, tools/list, tools/call)
- ✅ Proper capability negotiation
- ✅ Error handling with standard codes
- ✅ Tool schema definitions

## Differences from Original Implementation

This remote version differs from the original stdio-based MCP server:

1. **No stdio transport** - Only HTTP transport is supported
2. **Header-based credentials** - Slack credentials passed via headers instead of environment variables
3. **Stateless** - No session management; each request is independent
4. **Authentication** - Optional authentication middleware for tool execution
5. **Deployment-ready** - Designed for cloud deployment and scaling

## Troubleshooting

### "Missing required Slack credentials in headers"

Ensure you're passing both `x-slack-bot-token` and `x-slack-team-id` headers with your `tools/call` requests.

### "Authentication required for tool execution"

If `REQUIRE_AUTH=true` and `SECRET_KEY` is set, you must include the `x-secret-key` header with the correct value.

### "Method not found"

Verify you're using a valid MCP method: `initialize`, `tools/list`, or `tools/call`.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/zencoderai/slack-mcp-server/issues)
- Email: support@zencoder.ai
