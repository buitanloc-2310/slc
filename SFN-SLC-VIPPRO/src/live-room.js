export class LiveRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') return new Response('WebSocket required', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);
    const peerId = url.searchParams.get('peer') || crypto.randomUUID();
    const name = (url.searchParams.get('name') || 'Guest').slice(0, 80);
    const role = (url.searchParams.get('role') || 'guest').slice(0, 30);

    server.accept();
    this.clients.set(peerId, { ws: server, name, role });

    const roster = [...this.clients.entries()].map(([id, p]) => ({ id, name: p.name, role: p.role }));
    server.send(JSON.stringify({ type: 'welcome', peerId, roster }));
    this.broadcast({ type: 'peer-joined', peer: { id: peerId, name, role } }, peerId);

    server.addEventListener('message', evt => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      msg.from = peerId;
      msg.fromName = name;
      if (msg.to && this.clients.has(msg.to)) {
        try { this.clients.get(msg.to).ws.send(JSON.stringify(msg)); } catch {}
      } else {
        this.broadcast(msg, peerId);
      }
    });

    const cleanup = () => {
      if (!this.clients.has(peerId)) return;
      this.clients.delete(peerId);
      this.broadcast({ type: 'peer-left', peerId });
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(payload, exceptId = null) {
    const raw = JSON.stringify(payload);
    for (const [id, p] of this.clients.entries()) {
      if (id === exceptId) continue;
      try { p.ws.send(raw); } catch {}
    }
  }
}
