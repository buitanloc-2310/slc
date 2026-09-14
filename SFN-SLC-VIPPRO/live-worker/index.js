import { LiveRoom } from '../src/live-room.js';
export { LiveRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/live\/([^/]+)\/ws$/);
    if (!match) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket required', { status: 426 });
    const id = env.LIVE_ROOM.idFromName(match[1]);
    return env.LIVE_ROOM.get(id).fetch(request);
  }
};
