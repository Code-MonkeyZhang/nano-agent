import { WebSocketServer, WebSocket } from 'ws';
import { httpServer } from './http-server.js';

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Store all connected clients
const clients = new Map<string, WebSocket>();

/**
 * Create a message with timestamp
 * @param {any} message - The message object
 * @returns {string} JSON string with message and timestamp
 */
function createMessage(message: any): string {
  return JSON.stringify({
    ...message,
    timestamp: Date.now(),
  });
}

/**
 * Initialize the WebSocket server and set up connection handlers
 * Creates a WebSocket server attached to the HTTP server on /ws path
 * Handles connection, message, disconnection, and error events
 */
export function initWebSocket(): void {
  // Use http port to init ws
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Handles connection event
  wss.on('connection', (ws: WebSocket, _req: unknown) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    clients.set(clientId, ws);

    ws.send(
      createMessage({
        type: 'connected',
        clientId,
        message: 'Successfully connected to Nano Agent Server',
      })
    );

    // Handle messages from client
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`[WS] Message from ${clientId}:`, message.type);

        // Echo back for testing
        ws.send(
          createMessage({
            type: 'echo',
            originalMessage: message,
          })
        );
      } catch (error) {
        console.error('[WS] Invalid message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
      console.log(`[WS] Total clients: ${clients.size}`);
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error(`[WS] Client error ${clientId}:`, error);
      clients.delete(clientId);
    });
  });
}

/**
 * Gracefully shutdown the WebSocket server
 * Closes all client connections and the server itself
 * Clears the client map
 */
export function shutdownWebSocket(): void {
  if (wss) {
    for (const [clientId, ws] of clients.entries()) {
      ws.close();
      console.log(`[WS] Closed client ${clientId}`);
    }
    clients.clear();
    wss.close();
    wss = null;
    console.log('[WS] WebSocket server shutdown');
  }
}
