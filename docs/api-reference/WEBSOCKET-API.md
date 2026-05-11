# WebSocket API Reference

**Real-Time WebSocket API for AI Agent Communication**

Complete WebSocket API documentation for streaming AI agent interactions.

---

## Table of Contents

1. [Overview](#overview)
2. [Connection](#connection)
3. [Message Types](#message-types)
4. [Agent Stream](#agent-stream)
5. [Example Usage](#example-usage)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Overview

### WebSocket Endpoint

```
ws://localhost:46000/api/v1/agent/stream
```

### Features

- Real-time AI agent communication
- Streaming responses
- Bidirectional communication
- Progress updates
- Tool execution visibility

---

## Connection

### Establishing Connection

**Using wscat:**
```bash
wscat -c "ws://localhost:46000/api/v1/agent/stream?sessionId=test-session-1&token=YOUR_JWT_TOKEN"
```

**Using JavaScript:**
```javascript
const ws = new WebSocket(
  `ws://localhost:46000/api/v1/agent/stream?sessionId=${sessionId}&token=${jwtToken}`
);

ws.onopen = () => {
  console.log('Connected to agent stream');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from agent stream');
};
```

### Query Parameters

- `sessionId` (required): Unique session identifier
- `token` (required): JWT access token
- `projectId` (optional): Project context

---

## Message Types

### Client to Server

**1. Prompt Message:**
```json
{
  "type": "prompt",
  "content": "Create a dashboard showing temperature data from 10,000 sensors",
  "context": {
    "projectId": "proj_123456"
  }
}
```

**2. Tool Approval:**
```json
{
  "type": "tool_approval",
  "toolCallId": "call_abc123",
  "approved": true
}
```

**3. Ping:**
```json
{
  "type": "ping"
}
```

### Server to Client

**1. Agent Thinking:**
```json
{
  "type": "agent_thinking",
  "content": "Analyzing your request and querying available devices...",
  "timestamp": "2026-04-15T14:00:00Z"
}
```

**2. Agent Tool Call:**
```json
{
  "type": "agent_tool_call",
  "toolCallId": "call_abc123",
  "tool": "getDeviceList",
  "args": {
    "filter": "temperature",
    "limit": 10000
  },
  "timestamp": "2026-04-15T14:00:01Z"
}
```

**3. Tool Result:**
```json
{
  "type": "tool_result",
  "toolCallId": "call_abc123",
  "result": {
    "devices": [...],
    "count": 10234
  },
  "timestamp": "2026-04-15T14:00:05Z"
}
```

**4. Agent Response (Streaming):**
```json
{
  "type": "agent_response",
  "content": "I found 10,234 temperature sensors. ",
  "delta": true,
  "timestamp": "2026-04-15T14:00:06Z"
}
```

**5. Build Progress:**
```json
{
  "type": "build_progress",
  "step": "Generating chart components",
  "percentage": 45,
  "timestamp": "2026-04-15T14:00:10Z"
}
```

**6. Preview Update:**
```json
{
  "type": "preview_update",
  "previewId": "preview_xyz789",
  "url": "http://localhost:4300",
  "status": "running",
  "timestamp": "2026-04-15T14:00:20Z"
}
```

**7. Complete:**
```json
{
  "type": "complete",
  "projectId": "proj_123456",
  "summary": "Dashboard created successfully with 3 charts and 5 KPI cards",
  "timestamp": "2026-04-15T14:00:30Z"
}
```

**8. Error:**
```json
{
  "type": "error",
  "error": {
    "code": "TOOL_EXECUTION_FAILED",
    "message": "Failed to execute getDeviceList tool",
    "details": {}
  },
  "timestamp": "2026-04-15T14:00:15Z"
}
```

**9. Pong:**
```json
{
  "type": "pong",
  "timestamp": "2026-04-15T14:00:00Z"
}
```

---

## Agent Stream

### Complete Flow Example

**1. Client sends prompt:**
```json
{
  "type": "prompt",
  "content": "Create a temperature monitoring dashboard"
}
```

**2. Server responses (in sequence):**

```json
{"type": "agent_thinking", "content": "Understanding your requirements..."}

{"type": "agent_tool_call", "tool": "getDeviceList", "args": {"filter": "temperature"}}

{"type": "tool_result", "result": {"count": 156, "devices": [...]}}

{"type": "agent_response", "content": "I found 156 temperature sensors. "}
{"type": "agent_response", "content": "I'll create a dashboard with:"}
{"type": "agent_response", "content": "\n- Real-time temperature chart"}
{"type": "agent_response", "content": "\n- Current readings table"}
{"type": "agent_response", "content": "\n- Alert status panel"}

{"type": "build_progress", "step": "Generating components", "percentage": 25}
{"type": "build_progress", "step": "Creating chart widgets", "percentage": 50}
{"type": "build_progress", "step": "Configuring data sources", "percentage": 75}
{"type": "build_progress", "step": "Finalizing dashboard", "percentage": 100}

{"type": "preview_update", "url": "http://localhost:4300", "status": "running"}

{"type": "complete", "projectId": "proj_123456"}
```

---

## Example Usage

### Node.js Client

```javascript
import WebSocket from 'ws';

class AgentClient {
  constructor(sessionId, token) {
    this.ws = new WebSocket(
      `ws://localhost:46000/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
    );

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('error', (error) => this.onError(error));
    this.ws.on('close', () => this.onClose());
  }

  onOpen() {
    console.log('Connected to agent');
  }

  onMessage(data) {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'agent_thinking':
        console.log('Agent:', message.content);
        break;

      case 'agent_tool_call':
        console.log(`Calling tool: ${message.tool}`);
        break;

      case 'agent_response':
        process.stdout.write(message.content);
        break;

      case 'build_progress':
        console.log(`Progress: ${message.percentage}% - ${message.step}`);
        break;

      case 'complete':
        console.log('\nComplete!');
        break;

      case 'error':
        console.error('Error:', message.error);
        break;
    }
  }

  onError(error) {
    console.error('WebSocket error:', error);
  }

  onClose() {
    console.log('Disconnected');
  }

  sendPrompt(content) {
    this.ws.send(JSON.stringify({
      type: 'prompt',
      content
    }));
  }
}

// Usage
const client = new AgentClient('session-123', 'jwt-token');
client.sendPrompt('Create a dashboard for monitoring IoT devices');
```

### Browser Client

```javascript
class AgentStreamClient {
  constructor(sessionId, token, callbacks) {
    this.ws = new WebSocket(
      `ws://localhost:46000/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
    );
    this.callbacks = callbacks;

    this.ws.onopen = () => callbacks.onConnect?.();
    this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    this.ws.onerror = (error) => callbacks.onError?.(error);
    this.ws.onclose = () => callbacks.onDisconnect?.();
  }

  handleMessage(message) {
    const handler = this.callbacks[`on${this.capitalize(message.type)}`];
    if (handler) {
      handler(message);
    }
  }

  sendPrompt(content) {
    this.ws.send(JSON.stringify({
      type: 'prompt',
      content
    }));
  }

  capitalize(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      .replace(/^[a-z]/, (g) => g.toUpperCase());
  }

  close() {
    this.ws.close();
  }
}

// Usage
const agent = new AgentStreamClient('session-123', jwtToken, {
  onConnect: () => console.log('Connected'),
  onAgentThinking: (msg) => console.log('Thinking:', msg.content),
  onAgentResponse: (msg) => appendToChat(msg.content),
  onBuildProgress: (msg) => updateProgressBar(msg.percentage),
  onComplete: (msg) => showSuccess(),
  onError: (msg) => showError(msg.error),
  onDisconnect: () => console.log('Disconnected')
});

agent.sendPrompt('Create a dashboard');
```

---

## Error Handling

### Connection Errors

**Authentication Failed:**
```json
{
  "type": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**Session Limit Exceeded:**
```json
{
  "type": "error",
  "error": {
    "code": "SESSION_LIMIT_EXCEEDED",
    "message": "Maximum concurrent sessions exceeded for your tier"
  }
}
```

### Runtime Errors

**Tool Execution Failed:**
```json
{
  "type": "error",
  "error": {
    "code": "TOOL_EXECUTION_FAILED",
    "message": "Failed to execute getDeviceList",
    "details": {
      "tool": "getDeviceList",
      "reason": "API timeout"
    }
  }
}
```

---

## Best Practices

### 1. Heartbeat/Ping

Send periodic pings to keep connection alive:
```javascript
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000); // Every 30 seconds
```

### 2. Reconnection Logic

```javascript
class ResilientAgentClient {
  constructor(sessionId, token) {
    this.sessionId = sessionId;
    this.token = token;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(
      `ws://localhost:46000/api/v1/agent/stream?sessionId=${this.sessionId}&token=${this.token}`
    );

    this.ws.onclose = () => this.handleDisconnect();
  }

  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }
}
```

### 3. Message Queuing

Queue messages while disconnected:
```javascript
class QueuedAgentClient {
  constructor() {
    this.messageQueue = [];
    this.isConnected = false;
  }

  send(message) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  onConnect() {
    this.isConnected = true;
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.ws.send(JSON.stringify(message));
    }
  }
}
```

---

## Related Documentation

- [REST API Reference](./REST-API.md)
- [IoT Integration Guide](./IOT-INTEGRATION.md)
- [Development Guide](../guides/DEVELOPMENT-GUIDE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology API Team
