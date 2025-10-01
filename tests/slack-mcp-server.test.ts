import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fetch globally
(global as any).fetch = jest.fn();

// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    sessionId: 'test-session-id',
    onclose: null,
    handleRequest: jest.fn(),
  })),
}));

jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn(),
  };
  const mockExpress = jest.fn(() => mockApp);
  (mockExpress as any).json = jest.fn();
  return mockExpress;
});

// Mock process.env
const originalEnv = process.env;
const originalArgv = process.argv;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_TEAM_ID: 'T123456',
  };
  process.argv = originalArgv;
});

afterEach(() => {
  process.env = originalEnv;
  process.argv = originalArgv;
  jest.clearAllMocks();
});

describe('SlackClient', () => {
  let SlackClient: any;
  let slackClient: any;
  const mockFetch = (global as any).fetch;

  beforeEach(async () => {
    const indexModule = await import('../index.js');
    SlackClient = indexModule.SlackClient;
    slackClient = new SlackClient('xoxb-test-token');
  });

  test('SlackClient constructor creates headers', () => {
    expect(slackClient).toHaveProperty('botHeaders');
    expect((slackClient as any).botHeaders).toEqual({
      Authorization: 'Bearer xoxb-test-token',
      'Content-Type': 'application/json',
    });
  });

  test('getChannels with predefined IDs', async () => {
    process.env.SLACK_CHANNEL_IDS = 'C123456,C789012';
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          ok: true,
          channel: { id: 'C123456', name: 'general', is_archived: false },
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          ok: true,
          channel: { id: 'C789012', name: 'random', is_archived: false },
        }),
      });

    const result = await slackClient.getChannels();

    expect(result).toEqual({
      ok: true,
      channels: [
        { id: 'C123456', name: 'general', is_archived: false },
        { id: 'C789012', name: 'random', is_archived: false },
      ],
      response_metadata: { next_cursor: '' },
    });
  });

  test('getChannels with API call', async () => {
    delete process.env.SLACK_CHANNEL_IDS;
    const mockResponse = {
      ok: true,
      channels: [
        { id: 'C123456', name: 'general', is_archived: false },
        { id: 'C789012', name: 'random', is_archived: false },
      ],
      response_metadata: { next_cursor: '' },
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.getChannels();

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/conversations.list'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      })
    );
  });

  test('postMessage successful response', async () => {
    const mockResponse = {
      ok: true,
      channel: 'C123456',
      ts: '1234567890.123456',
      message: {
        text: 'Hello, world!',
        user: 'U123456',
        ts: '1234567890.123456',
      },
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.postMessage('C123456', 'Hello, world!');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'C123456',
          text: 'Hello, world!',
        }),
      }
    );
  });

  test('postReply successful response', async () => {
    const mockResponse = {
      ok: true,
      channel: 'C123456',
      ts: '1234567890.123457',
      message: {
        text: 'Reply text',
        user: 'U123456',
        ts: '1234567890.123457',
        thread_ts: '1234567890.123456',
      },
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.postReply('C123456', '1234567890.123456', 'Reply text');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'C123456',
          thread_ts: '1234567890.123456',
          text: 'Reply text',
        }),
      }
    );
  });

  test('addReaction successful response', async () => {
    const mockResponse = {
      ok: true,
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.addReaction('C123456', '1234567890.123456', 'thumbsup');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/reactions.add',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'C123456',
          timestamp: '1234567890.123456',
          name: 'thumbsup',
        }),
      }
    );
  });

  test('getChannelHistory successful response', async () => {
    const mockResponse = {
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123456',
          text: 'Hello',
          ts: '1234567890.123456',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.getChannelHistory('C123456', 10);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/conversations.history'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      })
    );
  });

  test('getThreadReplies successful response', async () => {
    const mockResponse = {
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123456',
          text: 'Parent message',
          ts: '1234567890.123456',
        },
        {
          type: 'message',
          user: 'U789012',
          text: 'Reply message',
          ts: '1234567890.123457',
          thread_ts: '1234567890.123456',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.getThreadReplies('C123456', '1234567890.123456');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/conversations.replies'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      })
    );
  });

  test('getUsers successful response', async () => {
    const mockResponse = {
      ok: true,
      members: [
        {
          id: 'U123456',
          name: 'testuser',
          real_name: 'Test User',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.getUsers(100);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/users.list'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      })
    );
  });

  test('getUserProfile successful response', async () => {
    const mockResponse = {
      ok: true,
      profile: {
        real_name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
      },
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await slackClient.getUserProfile('U123456');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/users.profile.get'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      })
    );
  });
});

describe('Remote MCP Server', () => {
  test('SlackClient accepts team_id and channel_ids', async () => {
    const { SlackClient } = await import('../index.js');
    
    const mockSlackClient = new SlackClient('xoxb-test-token', 'T123456', 'C123,C456');

    // Just test that the SlackClient is created and defined
    expect(mockSlackClient).toBeDefined();
    expect(typeof mockSlackClient).toBe('object');
  });
});

describe('HTTP Server', () => {
  test('express module can be imported', async () => {
    const express = await import('express');
    
    // Test that express module is available and mocked
    expect(express.default).toBeDefined();
    expect(typeof express.default).toBe('function');
  });

  test('SlackClient can be instantiated with credentials', async () => {
    const { SlackClient } = await import('../index.js');
    
    const mockSlackClient = new SlackClient('xoxb-test-token', 'T123456');
    
    // Test that SlackClient is created successfully
    expect(mockSlackClient).toBeDefined();
    expect(mockSlackClient).toHaveProperty('botHeaders');
  });

  test('index module exports expected functions', async () => {
    const indexModule = await import('../index.js');
    
    // Test that required exports are available
    expect(indexModule.SlackClient).toBeDefined();
    expect(indexModule.main).toBeDefined();
  });
});