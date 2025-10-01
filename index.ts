#!/usr/bin/env node
/**
 * Remote MCP Server for Slack
 * A remote MCP server that exposes Slack functionality via HTTP
 */

import express, { Request, Response, NextFunction } from "express";
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Type definitions for tool arguments
interface ListChannelsArgs {
  limit?: number;
  cursor?: string;
}

interface PostMessageArgs {
  channel_id: string;
  text: string;
}

interface ReplyToThreadArgs {
  channel_id: string;
  thread_ts: string;
  text: string;
}

interface AddReactionArgs {
  channel_id: string;
  timestamp: string;
  reaction: string;
}

interface GetChannelHistoryArgs {
  channel_id: string;
  limit?: number;
}

interface GetThreadRepliesArgs {
  channel_id: string;
  thread_ts: string;
}

interface GetUsersArgs {
  cursor?: string;
  limit?: number;
}

interface GetUserProfileArgs {
  user_id: string;
}

// Configuration from environment variables
const SECRET_KEY = process.env.SECRET_KEY || "";
const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "0.0.0.0";
const REQUIRE_AUTH = (process.env.REQUIRE_AUTH || "true").toLowerCase() === "true";

export class SlackClient {
  private botHeaders: { Authorization: string; "Content-Type": string };
  private teamId: string;
  private channelIds?: string;

  constructor(botToken: string, teamId: string, channelIds?: string) {
    this.botHeaders = {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    };
    this.teamId = teamId;
    this.channelIds = channelIds;
  }

  async getChannels(limit: number = 100, cursor?: string): Promise<any> {
    const predefinedChannelIds = this.channelIds;
    if (!predefinedChannelIds) {
      const params = new URLSearchParams({
        types: "public_channel,private_channel",
        exclude_archived: "true",
        limit: Math.min(limit, 200).toString(),
        team_id: this.teamId,
      });
  
      if (cursor) {
        params.append("cursor", cursor);
      }
  
      const response = await fetch(
        `https://slack.com/api/conversations.list?${params}`,
        { headers: this.botHeaders },
      );
  
      return response.json();
    }

    const predefinedChannelIdsArray = predefinedChannelIds.split(",").map((id: string) => id.trim());
    const channels = [];

    for (const channelId of predefinedChannelIdsArray) {
      const params = new URLSearchParams({
        channel: channelId,
      });

      const response = await fetch(
        `https://slack.com/api/conversations.info?${params}`,
        { headers: this.botHeaders }
      );
      const data = await response.json();

      if (data.ok && data.channel && !data.channel.is_archived) {
        channels.push(data.channel);
      }
    }

    return {
      ok: true,
      channels: channels,
      response_metadata: { next_cursor: "" },
    };
  }

  async postMessage(channel_id: string, text: string): Promise<any> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        text: text,
      }),
    });

    return response.json();
  }

  async postReply(
    channel_id: string,
    thread_ts: string,
    text: string,
  ): Promise<any> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        thread_ts: thread_ts,
        text: text,
      }),
    });

    return response.json();
  }

  async addReaction(
    channel_id: string,
    timestamp: string,
    reaction: string,
  ): Promise<any> {
    const response = await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        timestamp: timestamp,
        name: reaction,
      }),
    });

    return response.json();
  }

  async getChannelHistory(
    channel_id: string,
    limit: number = 10,
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      limit: limit.toString(),
    });

    const response = await fetch(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getThreadReplies(channel_id: string, thread_ts: string): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      ts: thread_ts,
    });

    const response = await fetch(
      `https://slack.com/api/conversations.replies?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getUsers(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      limit: Math.min(limit, 200).toString(),
      team_id: this.teamId,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(`https://slack.com/api/users.list?${params}`, {
      headers: this.botHeaders,
    });

    return response.json();
  }

  async getUserProfile(user_id: string): Promise<any> {
    const params = new URLSearchParams({
      user: user_id,
      include_labels: "true",
    });

    const response = await fetch(
      `https://slack.com/api/users.profile.get?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }
}

// Define available tools
function getToolsList() {
  return [
    {
      name: "slack_list_channels",
      description: "List public and private channels that the bot is a member of, or pre-defined channels in the workspace with pagination",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of channels to return (default 100, max 200)",
            default: 100
          },
          cursor: {
            type: "string",
            description: "Pagination cursor for next page of results"
          }
        }
      }
    },
    {
      name: "slack_post_message",
      description: "Post a new message to a Slack channel or direct message to user",
      inputSchema: {
        type: "object",
        properties: {
          channel_id: {
            type: "string",
            description: "The ID of the channel or user to post to"
          },
          text: {
            type: "string",
            description: "The message text to post"
          }
        },
        required: ["channel_id", "text"]
      }
    },
    {
      name: "slack_reply_to_thread",
      description: "Reply to a specific message thread in Slack",
      inputSchema: {
        type: "object",
        properties: {
          channel_id: {
            type: "string",
            description: "The ID of the channel containing the thread"
          },
          thread_ts: {
            type: "string",
            description: "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it."
          },
          text: {
            type: "string",
            description: "The reply text"
          }
        },
        required: ["channel_id", "thread_ts", "text"]
      }
    },
    {
      name: "slack_add_reaction",
      description: "Add a reaction emoji to a message",
      inputSchema: {
        type: "object",
        properties: {
          channel_id: {
            type: "string",
            description: "The ID of the channel containing the message"
          },
          timestamp: {
            type: "string",
            description: "The timestamp of the message to react to"
          },
          reaction: {
            type: "string",
            description: "The name of the emoji reaction (without ::)"
          }
        },
        required: ["channel_id", "timestamp", "reaction"]
      }
    },
    {
      name: "slack_get_channel_history",
      description: "Get recent messages from a channel",
      inputSchema: {
        type: "object",
        properties: {
          channel_id: {
            type: "string",
            description: "The ID of the channel"
          },
          limit: {
            type: "number",
            description: "Number of messages to retrieve (default 10)",
            default: 10
          }
        },
        required: ["channel_id"]
      }
    },
    {
      name: "slack_get_thread_replies",
      description: "Get all replies in a message thread",
      inputSchema: {
        type: "object",
        properties: {
          channel_id: {
            type: "string",
            description: "The ID of the channel containing the thread"
          },
          thread_ts: {
            type: "string",
            description: "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it."
          }
        },
        required: ["channel_id", "thread_ts"]
      }
    },
    {
      name: "slack_get_users",
      description: "Get a list of all users in the workspace with their basic profile information",
      inputSchema: {
        type: "object",
        properties: {
          cursor: {
            type: "string",
            description: "Pagination cursor for next page of results"
          },
          limit: {
            type: "number",
            description: "Maximum number of users to return (default 100, max 200)",
            default: 100
          }
        }
      }
    },
    {
      name: "slack_get_user_profile",
      description: "Get detailed profile information for a specific user",
      inputSchema: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "The ID of the user"
          }
        },
        required: ["user_id"]
      }
    }
  ];
}

// Handle tool execution
async function handleToolCall(toolName: string, args: any, slackClient: SlackClient): Promise<any> {
  try {
    let response;

    switch (toolName) {
      case "slack_list_channels":
        response = await slackClient.getChannels(args.limit, args.cursor);
        break;
      
      case "slack_post_message":
        response = await slackClient.postMessage(args.channel_id, args.text);
        break;
      
      case "slack_reply_to_thread":
        response = await slackClient.postReply(args.channel_id, args.thread_ts, args.text);
        break;
      
      case "slack_add_reaction":
        response = await slackClient.addReaction(args.channel_id, args.timestamp, args.reaction);
        break;
      
      case "slack_get_channel_history":
        response = await slackClient.getChannelHistory(args.channel_id, args.limit);
        break;
      
      case "slack_get_thread_replies":
        response = await slackClient.getThreadReplies(args.channel_id, args.thread_ts);
        break;
      
      case "slack_get_users":
        response = await slackClient.getUsers(args.limit, args.cursor);
        break;
      
      case "slack_get_user_profile":
        response = await slackClient.getUserProfile(args.user_id);
        break;
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message || String(error),
            status: "failed"
          }, null, 2)
        }
      ]
    };
  }
}

// Authentication middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth if not required
  if (!REQUIRE_AUTH) {
    return next();
  }

  // Skip auth if SECRET_KEY is not configured
  if (!SECRET_KEY) {
    console.warn("SECRET_KEY not configured but REQUIRE_AUTH is true");
    return next();
  }

  // Only check auth for /mcp endpoint with POST method
  if (req.path === "/mcp" && req.method === "POST") {
    try {
      const method = req.body?.method;

      // Only require auth for tools/call
      if (method === "tools/call") {
        const providedKey = req.headers["x-secret-key"] as string | undefined;

        if (!providedKey) {
          const clientHost = req.ip || "unknown";
          console.warn(`Missing x-secret-key header from ${clientHost} for tools/call`);
          return res.status(401).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Authentication required for tool execution"
            },
            id: req.body?.id || null
          });
        }

        if (providedKey !== SECRET_KEY) {
          const clientHost = req.ip || "unknown";
          console.warn(`Invalid x-secret-key from ${clientHost} for tools/call`);
          return res.status(401).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Invalid authentication for tool execution"
            },
            id: req.body?.id || null
          });
        }
      }
      // For discovery methods (initialize, tools/list), allow without auth
      else if (method === "initialize" || method === "tools/list") {
        console.log(`Allowing unauthenticated ${method} request`);
      }
    } catch (error) {
      console.error("Error in auth middleware:", error);
      // On error, let the request through to be handled properly
    }
  }

  next();
}

// Main HTTP server
function createHttpServer() {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "mcp-slack-server"
    });
  });

  // Root endpoint with server information
  app.get("/", (req: Request, res: Response) => {
    res.json({
      service: "MCP Slack Server",
      version: "1.0.0",
      description: "Model Context Protocol server for Slack integration",
      endpoints: {
        "/health": "Health check endpoint",
        "/mcp": "MCP JSON-RPC endpoint",
        "/tools": "List available tools"
      }
    });
  });

  // List tools endpoint
  app.get("/tools", (req: Request, res: Response) => {
    res.json({
      tools: getToolsList()
    });
  });

  // Main MCP endpoint
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      console.log("Received MCP request:", JSON.stringify(body, null, 2));

      const method = body.method;
      const params = body.params || {};
      const requestId = body.id;

      // Extract Slack credentials from headers
      const slackBotToken = req.headers["x-slack-bot-token"] as string | undefined;
      const slackTeamId = req.headers["x-slack-team-id"] as string | undefined;
      const slackChannelIds = req.headers["x-slack-channel-ids"] as string | undefined;

      // Route to appropriate handler based on method
      if (method === "initialize") {
        const result = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            prompts: null,
            resources: null
          },
          serverInfo: {
            name: "slack-mcp-server",
            version: "1.0.0"
          }
        };

        return res.json({
          jsonrpc: "2.0",
          result,
          id: requestId
        });
      } else if (method === "tools/list") {
        const result = {
          tools: getToolsList()
        };

        return res.json({
          jsonrpc: "2.0",
          result,
          id: requestId
        });
      } else if (method === "tools/call") {
        // Validate Slack credentials for tool execution
        if (!slackBotToken || !slackTeamId) {
          return res.json({
            jsonrpc: "2.0",
            error: {
              code: -32602,
              message: "Missing required Slack credentials in headers: x-slack-bot-token and x-slack-team-id are required"
            },
            id: requestId
          });
        }

        // Create Slack client with credentials from headers
        const slackClient = new SlackClient(slackBotToken, slackTeamId, slackChannelIds);

        const toolName = params.name;
        const toolArguments = params.arguments || {};

        const result = await handleToolCall(toolName, toolArguments, slackClient);

        return res.json({
          jsonrpc: "2.0",
          result,
          id: requestId
        });
      } else {
        // Method not found
        return res.json({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          },
          id: requestId
        });
      }
    } catch (error: any) {
      console.error("Error handling MCP request:", error);
      return res.json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: `Internal error: ${error.message || String(error)}`
        },
        id: req.body?.id || null
      });
    }
  });

  return app;
}

export async function main() {
  console.log(`Starting MCP Slack Server on ${HOST}:${PORT}`);
  console.log(`Authentication enabled: ${REQUIRE_AUTH}`);
  console.log(`Secret Key configured: ${SECRET_KEY ? 'Yes' : 'No'}`);

  const app = createHttpServer();
  
  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`MCP Slack Server running on http://${HOST}:${PORT}`);
    console.log(`Health check available at http://${HOST}:${PORT}/health`);
    console.log(`MCP endpoint at http://${HOST}:${PORT}/mcp`);
  });

  // Setup graceful shutdown handlers
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    
    httpServer.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    
    // Force close after 5 seconds
    setTimeout(() => {
      console.error('Forcing shutdown...');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
}

// Only run main() if this file is executed directly, not when imported by tests
// This handles both direct execution and global npm installation
if (import.meta.url.startsWith('file://')) {
  const currentFile = fileURLToPath(import.meta.url);
  const executedFile = process.argv[1] ? resolve(process.argv[1]) : '';
  
  // Check if this is the main module being executed
  // Don't run if we're in a test environment (jest)
  const isTestEnvironment = process.argv.some(arg => arg.includes('jest')) || 
                            process.env.NODE_ENV === 'test' ||
                            process.argv[1]?.includes('jest');
  
  const isMainModule = !isTestEnvironment && (
    currentFile === executedFile || 
    (process.argv[1] && process.argv[1].includes('slack-mcp')) ||
    (process.argv[0].includes('node') && process.argv[1] && !process.argv[1].includes('test'))
  );
  
  if (isMainModule) {
    main().catch((error) => {
      console.error("Fatal error in main():", error);
      process.exit(1);
    });
  }
}