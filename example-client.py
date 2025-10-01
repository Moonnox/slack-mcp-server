#!/usr/bin/env python3
"""
Example Python client for Slack MCP Server
This script demonstrates how to interact with the remote MCP server from Python
"""

import os
import json
import requests
from typing import Optional, Dict, Any

class SlackMCPClient:
    """Client for interacting with the Slack MCP Server"""
    
    def __init__(
        self,
        server_url: str = "http://localhost:8080",
        slack_bot_token: Optional[str] = None,
        slack_team_id: Optional[str] = None,
        secret_key: Optional[str] = None,
        slack_channel_ids: Optional[str] = None
    ):
        self.server_url = server_url
        self.slack_bot_token = slack_bot_token or os.getenv("SLACK_BOT_TOKEN")
        self.slack_team_id = slack_team_id or os.getenv("SLACK_TEAM_ID")
        self.secret_key = secret_key or os.getenv("SECRET_KEY")
        self.slack_channel_ids = slack_channel_ids or os.getenv("SLACK_CHANNEL_IDS")
        self.request_id = 0
    
    def _get_next_id(self) -> int:
        """Get next request ID"""
        self.request_id += 1
        return self.request_id
    
    def _get_headers(self, include_slack_creds: bool = False) -> Dict[str, str]:
        """Get headers for the request"""
        headers = {
            "Content-Type": "application/json"
        }
        
        if include_slack_creds:
            if self.slack_bot_token:
                headers["x-slack-bot-token"] = self.slack_bot_token
            if self.slack_team_id:
                headers["x-slack-team-id"] = self.slack_team_id
            if self.slack_channel_ids:
                headers["x-slack-channel-ids"] = self.slack_channel_ids
            if self.secret_key:
                headers["x-secret-key"] = self.secret_key
        
        return headers
    
    def health_check(self) -> Dict[str, Any]:
        """Check server health"""
        response = requests.get(f"{self.server_url}/health")
        response.raise_for_status()
        return response.json()
    
    def get_server_info(self) -> Dict[str, Any]:
        """Get server information"""
        response = requests.get(f"{self.server_url}/")
        response.raise_for_status()
        return response.json()
    
    def initialize(self) -> Dict[str, Any]:
        """Initialize MCP connection"""
        payload = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "python-client",
                    "version": "1.0.0"
                }
            },
            "id": self._get_next_id()
        }
        
        response = requests.post(
            f"{self.server_url}/mcp",
            headers=self._get_headers(),
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def list_tools(self) -> Dict[str, Any]:
        """List available tools"""
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "params": {},
            "id": self._get_next_id()
        }
        
        response = requests.post(
            f"{self.server_url}/mcp",
            headers=self._get_headers(),
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool"""
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            },
            "id": self._get_next_id()
        }
        
        response = requests.post(
            f"{self.server_url}/mcp",
            headers=self._get_headers(include_slack_creds=True),
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    # Convenience methods for Slack operations
    
    def list_channels(self, limit: int = 100, cursor: Optional[str] = None) -> Dict[str, Any]:
        """List Slack channels"""
        args = {"limit": limit}
        if cursor:
            args["cursor"] = cursor
        return self.call_tool("slack_list_channels", args)
    
    def post_message(self, channel_id: str, text: str) -> Dict[str, Any]:
        """Post a message to Slack"""
        return self.call_tool("slack_post_message", {
            "channel_id": channel_id,
            "text": text
        })
    
    def reply_to_thread(self, channel_id: str, thread_ts: str, text: str) -> Dict[str, Any]:
        """Reply to a Slack thread"""
        return self.call_tool("slack_reply_to_thread", {
            "channel_id": channel_id,
            "thread_ts": thread_ts,
            "text": text
        })
    
    def add_reaction(self, channel_id: str, timestamp: str, reaction: str) -> Dict[str, Any]:
        """Add reaction to a message"""
        return self.call_tool("slack_add_reaction", {
            "channel_id": channel_id,
            "timestamp": timestamp,
            "reaction": reaction
        })
    
    def get_channel_history(self, channel_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get channel history"""
        return self.call_tool("slack_get_channel_history", {
            "channel_id": channel_id,
            "limit": limit
        })
    
    def get_thread_replies(self, channel_id: str, thread_ts: str) -> Dict[str, Any]:
        """Get thread replies"""
        return self.call_tool("slack_get_thread_replies", {
            "channel_id": channel_id,
            "thread_ts": thread_ts
        })
    
    def get_users(self, limit: int = 100, cursor: Optional[str] = None) -> Dict[str, Any]:
        """Get workspace users"""
        args = {"limit": limit}
        if cursor:
            args["cursor"] = cursor
        return self.call_tool("slack_get_users", args)
    
    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile"""
        return self.call_tool("slack_get_user_profile", {
            "user_id": user_id
        })


def main():
    """Example usage"""
    print("Slack MCP Client Example\n")
    
    # Create client
    client = SlackMCPClient()
    
    # Test 1: Health check
    print("1. Health Check")
    try:
        health = client.health_check()
        print(f"   Status: {health['status']}")
        print()
    except Exception as e:
        print(f"   Error: {e}\n")
    
    # Test 2: Server info
    print("2. Server Information")
    try:
        info = client.get_server_info()
        print(f"   Service: {info['service']}")
        print(f"   Version: {info['version']}")
        print()
    except Exception as e:
        print(f"   Error: {e}\n")
    
    # Test 3: Initialize
    print("3. Initialize MCP Connection")
    try:
        init_result = client.initialize()
        print(f"   Protocol: {init_result['result']['protocolVersion']}")
        print(f"   Server: {init_result['result']['serverInfo']['name']}")
        print()
    except Exception as e:
        print(f"   Error: {e}\n")
    
    # Test 4: List tools
    print("4. List Available Tools")
    try:
        tools_result = client.list_tools()
        tools = tools_result['result']['tools']
        print(f"   Found {len(tools)} tools:")
        for tool in tools:
            print(f"   - {tool['name']}: {tool['description']}")
        print()
    except Exception as e:
        print(f"   Error: {e}\n")
    
    # Test 5: List channels (requires credentials)
    if client.slack_bot_token and client.slack_team_id:
        print("5. List Slack Channels")
        try:
            channels_result = client.list_channels(limit=5)
            result_content = json.loads(channels_result['result']['content'][0]['text'])
            if result_content.get('ok'):
                channels = result_content.get('channels', [])
                print(f"   Found {len(channels)} channels:")
                for channel in channels:
                    print(f"   - {channel['name']} ({channel['id']})")
            else:
                print(f"   Error: {result_content.get('error', 'Unknown error')}")
            print()
        except Exception as e:
            print(f"   Error: {e}\n")
        
        # Test 6: Post message (if channel ID is provided)
        channel_id = os.getenv("CHANNEL_ID")
        if channel_id:
            print("6. Post Test Message")
            try:
                from datetime import datetime
                message_result = client.post_message(
                    channel_id,
                    f"Test message from Python MCP client at {datetime.now().isoformat()}"
                )
                result_content = json.loads(message_result['result']['content'][0]['text'])
                if result_content.get('ok'):
                    print(f"   Message posted successfully!")
                    print(f"   Timestamp: {result_content.get('ts')}")
                else:
                    print(f"   Error: {result_content.get('error', 'Unknown error')}")
                print()
            except Exception as e:
                print(f"   Error: {e}\n")
        else:
            print("6. Post Test Message")
            print("   Skipped: Set CHANNEL_ID environment variable to test")
            print()
    else:
        print("5-6. Slack Operations")
        print("   Skipped: Set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables to test")
        print()
    
    print("Example completed!")


if __name__ == "__main__":
    main()

