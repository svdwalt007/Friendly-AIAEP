import { Injectable, signal, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AgentMessage {
  type: 'user' | 'agent_thinking' | 'agent_response' | 'agent_tool_call' | 'build_progress' | 'error' | 'complete';
  content: string;
  sessionId?: string;
  done?: boolean;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class AgentStreamService {
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);
  private ws: WebSocket | null = null;

  private messagesSignal = signal<AgentMessage[]>([]);
  private connectedSignal = signal(false);
  private streamingSignal = signal(false);

  readonly messages = this.messagesSignal.asReadonly();
  readonly connected = this.connectedSignal.asReadonly();
  readonly streaming = this.streamingSignal.asReadonly();

  connect(sessionId: string): void {
    const token = this.authService.getToken();
    if (!token) return;

    const wsUrl = environment.apiUrl.replace(/^http/, 'ws');
    this.ws = new WebSocket(`${wsUrl}/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`);

    this.ws.onopen = () => {
      this.ngZone.run(() => {
        this.connectedSignal.set(true);
      });
    };

    this.ws.onmessage = (event) => {
      this.ngZone.run(() => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {
          // ignore parse errors
        }
      });
    };

    this.ws.onclose = () => {
      this.ngZone.run(() => {
        this.connectedSignal.set(false);
        this.streamingSignal.set(false);
      });
    };

    this.ws.onerror = () => {
      this.ngZone.run(() => {
        this.connectedSignal.set(false);
      });
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectedSignal.set(false);
    this.streamingSignal.set(false);
  }

  sendMessage(content: string): void {
    this.addMessage({ type: 'user', content, timestamp: new Date() });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content }));
    }
  }

  clearMessages(): void {
    this.messagesSignal.set([]);
  }

  private handleMessage(data: Record<string, unknown>): void {
    const msg: AgentMessage = {
      type: data['type'] as AgentMessage['type'],
      content: (data['content'] ?? data['message'] ?? '') as string,
      sessionId: data['sessionId'] as string | undefined,
      done: data['done'] as boolean | undefined,
      timestamp: new Date(),
    };

    if (msg.type === 'agent_thinking' || msg.type === 'agent_response') {
      this.streamingSignal.set(!msg.done);
    }

    if (msg.type === 'complete' || msg.type === 'error') {
      this.streamingSignal.set(false);
    }

    this.addMessage(msg);
  }

  private addMessage(msg: AgentMessage): void {
    this.messagesSignal.update((msgs) => [...msgs, msg]);
  }
}
