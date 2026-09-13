export class LiveRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') return new Response('WebSocket required', { status: 426 });

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const classId = parts.length >= 3 ? parts[2] : '';
    const token = url.searchParams.get('token') || '';
    if (!classId || !token) return new Response('Unauthorized', { status: 401 });

    let access;
    try {
      access = await this.env.DB.prepare(`
        SELECT t.token,t.class_id,t.user_id,t.guest_name,t.role,t.expires_at,
               COALESCE(u.full_name,t.guest_name,'Guest') display_name
        FROM live_access_tokens t
        LEFT JOIN users u ON u.id=t.user_id
        WHERE t.token=? AND t.class_id=? AND t.expires_at>CURRENT_TIMESTAMP
        LIMIT 1
      `).bind(token,classId).first();
    } catch {
      return new Response('Live access is not ready', { status: 503 });
    }
    if (!access) return new Response('Unauthorized', { status: 401 });

    let maxPeers = 18;
    try {
      const row = await this.env.DB.prepare(`SELECT value FROM system_settings WHERE key='live_mesh_max_peers'`).first();
      maxPeers = Math.max(4, Math.min(40, Number(row?.value || 18)));
    } catch {}
    if (this.clients.size >= maxPeers) return new Response('Room capacity reached', { status: 429 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const peerId = crypto.randomUUID();
    const name = String(access.display_name || 'Guest').slice(0, 80);
    const role = String(access.role || 'guest').slice(0, 30);

    server.accept();
    this.clients.set(peerId, { ws: server, name, role, userId: access.user_id || null, joinedAt: Date.now() });

    const roster = [...this.clients.entries()].map(([id, p]) => ({ id, name: p.name, role: p.role }));
    server.send(JSON.stringify({ type: 'welcome', peerId, roster, room: { classId, maxPeers } }));
    this.broadcast({ type: 'peer-joined', peer: { id: peerId, name, role } }, peerId);

    server.addEventListener('message', evt => {
      if (typeof evt.data === 'string' && evt.data.length > 120000) return;
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      const allowed = new Set(['offer','answer','ice','chat','reaction','raise-hand','presence']);
      if (!allowed.has(msg.type)) return;
      if (msg.type === 'chat') msg.text = String(msg.text || '').slice(0, 2000);
      msg.from = peerId;
      msg.fromName = name;
      msg.fromRole = role;
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
