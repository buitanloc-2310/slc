export class LiveRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
    this.locked = false;
    this.mode = 'classroom';
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

    const role = String(access.role || 'guest').slice(0, 30);
    const isHost = role === 'teacher' || role === 'assistant';
    if (this.locked && !isHost) return new Response('Room locked', { status: 423 });

    let maxPeers = 18;
    try {
      const row = await this.env.DB.prepare(`SELECT value FROM system_settings WHERE key='live_mesh_max_peers'`).first();
      maxPeers = Math.max(4, Math.min(40, Number(row?.value || 18)));
      const profile = await this.env.DB.prepare(`SELECT room_mode,capacity FROM class_profiles WHERE class_id=?`).bind(classId).first();
      if (profile?.room_mode) this.mode = String(profile.room_mode);
      if (profile?.capacity) maxPeers = Math.min(maxPeers, Math.max(4, Number(profile.capacity)));
    } catch {}
    if (this.clients.size >= maxPeers) return new Response('Room capacity reached', { status: 429 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const peerId = crypto.randomUUID();
    const name = String(access.display_name || 'Guest').slice(0, 80);

    server.accept();
    this.clients.set(peerId, { ws: server, name, role, userId: access.user_id || null, joinedAt: Date.now(), mic:false, cam:false, screen:false, hand:false });

    const roster = [...this.clients.entries()].map(([id, p]) => ({ id, name:p.name, role:p.role, mic:p.mic, cam:p.cam, screen:p.screen, hand:p.hand }));
    server.send(JSON.stringify({ type:'welcome', peerId, roster, room:{ classId, maxPeers, locked:this.locked, mode:this.mode } }));
    this.broadcast({ type:'peer-joined', peer:{ id:peerId, name, role, mic:false, cam:false, screen:false, hand:false } }, peerId);

    server.addEventListener('message', evt => {
      if (typeof evt.data !== 'string' || evt.data.length > 120000) return;
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      const allowed = new Set(['offer','answer','ice','chat','reaction','raise-hand','presence','control','room-control']);
      if (!allowed.has(msg.type)) return;

      const sender = this.clients.get(peerId);
      if (!sender) return;

      if (msg.type === 'chat') msg.text = String(msg.text || '').slice(0, 2000);
      if (msg.type === 'reaction') msg.emoji = String(msg.emoji || '').slice(0, 8);
      if (msg.type === 'presence') {
        sender.mic = !!msg.mic; sender.cam = !!msg.cam; sender.screen = !!msg.screen;
        msg = { type:'presence', peerId, mic:sender.mic, cam:sender.cam, screen:sender.screen };
      }
      if (msg.type === 'raise-hand') {
        sender.hand = msg.raised !== false;
        msg = { type:'raise-hand', peerId, raised:sender.hand, fromName:name };
      }
      if (msg.type === 'control') {
        if (!isHost) return;
        const action = String(msg.action || '');
        if (!['mute','camera-off','remove'].includes(action)) return;
        const target = this.clients.get(String(msg.to || ''));
        if (!target) return;
        if (action === 'remove') {
          try { target.ws.send(JSON.stringify({type:'control',action:'remove',from:peerId,fromName:name})); } catch {}
          try { target.ws.close(4001,'Removed by host'); } catch {}
          return;
        }
        try { target.ws.send(JSON.stringify({type:'control',action,from:peerId,fromName:name})); } catch {}
        return;
      }
      if (msg.type === 'room-control') {
        if (!isHost) return;
        const action = String(msg.action || '');
        if (action === 'lock') this.locked = true;
        else if (action === 'unlock') this.locked = false;
        else if (action === 'mode' && ['classroom','presentation','discussion','webinar'].includes(msg.mode)) this.mode = msg.mode;
        else if (action === 'mute-all') {
          for (const [id,p] of this.clients) if (id !== peerId) { try { p.ws.send(JSON.stringify({type:'control',action:'mute',from:peerId,fromName:name})); } catch {} }
        } else return;
        this.broadcast({type:'room-state',locked:this.locked,mode:this.mode,by:name});
        return;
      }

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
      this.broadcast({ type:'peer-left', peerId });
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status:101, webSocket:client });
  }

  broadcast(payload, exceptId = null) {
    const raw = JSON.stringify(payload);
    for (const [id, p] of this.clients.entries()) {
      if (id === exceptId) continue;
      try { p.ws.send(raw); } catch {}
    }
  }
}
