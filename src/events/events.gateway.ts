import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { AuthService } from '../auth/auth.service';
import { Logger } from '@nestjs/common';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  permissions?: string[];
  isAlive: boolean;
  requestCount: number;
  lastRequestReset: number;
}

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly RATE_LIMIT = 50; // messages per minute
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  constructor(private authService: AuthService) {
    // Heartbeat interval
    setInterval(() => {
      this.server.clients.forEach((ws: AuthenticatedSocket) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleConnection(client: AuthenticatedSocket, req: IncomingMessage) {
    client.isAlive = true;
    client.requestCount = 0;
    client.lastRequestReset = Date.now();
    client.on('pong', () => (client.isAlive = true));
    
    // Extract userId from query params or auth token
    // For MVP, we'll assume it's passed in query: ?userId=...
    // In production, use JWT validation
    const url = new URL(req.url || '', 'http://localhost');
    const userId = url.searchParams.get('userId');

    if (userId) {
      client.userId = userId;
      this.joinRoom(client, userId);
      this.logger.log(`Client connected: ${userId}`);
    } else {
      this.logger.log('Client connected without userId');
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    const room = this.rooms.get(userId);
    if (room) {
      const message = JSON.stringify({ event, data });
      room.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log('Client disconnected');
    // Remove from all rooms
    this.rooms.forEach((clients) => {
      if (clients.has(client)) {
        clients.delete(client);
      }
    });
  }

  private checkRateLimit(client: AuthenticatedSocket): boolean {
    const now = Date.now();
    if (now - client.lastRequestReset > this.RATE_LIMIT_WINDOW) {
      client.requestCount = 0;
      client.lastRequestReset = now;
    }

    client.requestCount++;
    return client.requestCount <= this.RATE_LIMIT;
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.checkRateLimit(client)) {
      return { event: 'error', message: 'Rate limit exceeded' };
    }

    const { apiKey, signature, nonce, payload } = data;

    if (!apiKey || !signature || !nonce) {
      return {
        event: 'auth',
        status: 'failed',
        message: 'Missing credentials',
      };
    }

    const keyEntity = await this.authService.findApiKey(apiKey);
    if (!keyEntity) {
      return { event: 'auth', status: 'failed', message: 'Invalid API key' };
    }

    // Validate signature
    // For WS, payload is usually just the nonce + 'auth' or similar,
    // Let's assume the client sends the payload they signed.
    const validPayload = payload || `AUTH${nonce}`;

    const isValid = this.authService.validateSignature(
      keyEntity.secretKey,
      signature,
      validPayload,
    );

    if (!isValid) {
      return { event: 'auth', status: 'failed', message: 'Invalid signature' };
    }

    client.userId = keyEntity.userId;
    client.permissions = keyEntity.permissions;

    // Auto-join user room
    this.joinRoom(client, `user:${client.userId}`);

    return { event: 'auth', status: 'ok', userId: client.userId };
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channel: string; symbol?: string },
  ) {
    if (!this.checkRateLimit(client)) {
      return { event: 'error', message: 'Rate limit exceeded' };
    }

    const { channel, symbol } = data;
    let roomName = '';

    if (channel === 'orderbook' && symbol) {
      roomName = `market:${symbol}`;
    } else if (channel === 'trades' && symbol) {
      roomName = `trades:${symbol}`;
    } else if (channel === 'user') {
      if (!client.userId) {
        return { event: 'error', message: 'Authentication required' };
      }
      // Already joined in auth, but can rejoin
      roomName = `user:${client.userId}`;
    } else {
      return { event: 'error', message: 'Invalid channel or symbol' };
    }

    this.joinRoom(client, roomName);
    return { event: 'subscribed', channel, symbol, room: roomName };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    const { room } = data;
    this.leaveRoom(client, room);
    return { event: 'unsubscribed', room };
  }

  private joinRoom(client: WebSocket, room: string) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(client);
  }

  private leaveRoom(client: WebSocket, room: string) {
    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(client);
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  // Public method to emit events to rooms
  emitToRoom(room: string, event: string, data: any) {
    const clients = this.rooms.get(room);
    if (clients) {
      const message = JSON.stringify({ event, data });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }
}
