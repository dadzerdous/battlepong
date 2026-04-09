const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

const TICK_RATE = 1000 / 60;
const ROOM_CODE_LEN = 5;
const PADDLE_SPEED = 7;
const PADDLE_WIDTH = 110;
const PADDLE_HEIGHT = 12;
const BALL_RADIUS = 7;
const ARENA_W = 480;
const ARENA_H = 640;
const SCORE_TO_WIN = 3;

const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function makeRoom() {
  return {
    code: makeCode(),
    players: [],
    state: {
      phase: 'waiting',
      width: ARENA_W,
      height: ARENA_H,
      score1: 0,
      score2: 0,
      paddles: {
        p1: { x: ARENA_W / 2 - PADDLE_WIDTH / 2, y: ARENA_H - 40, w: PADDLE_WIDTH, h: PADDLE_HEIGHT },
        p2: { x: ARENA_W / 2 - PADDLE_WIDTH / 2, y: 28, w: PADDLE_WIDTH, h: PADDLE_HEIGHT }
      },
      inputs: {
        p1: { left: false, right: false, ability: false },
        p2: { left: false, right: false, ability: false }
      },
      ball: {
        x: ARENA_W / 2,
        y: ARENA_H / 2,
        vx: 3.5,
        vy: 3.5,
        r: BALL_RADIUS
      }
    }
  };
}

function send(ws, type, data = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function broadcast(room, type, data = {}) {
  room.players.forEach(player => send(player.ws, type, data));
}

function resetBall(room, toward = 1) {
  room.state.ball.x = room.state.width / 2;
  room.state.ball.y = room.state.height / 2;
  room.state.ball.vx = (Math.random() < 0.5 ? -1 : 1) * 3.5;
  room.state.ball.vy = 3.5 * toward;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hits(ball, paddle) {
  return (
    ball.x + ball.r > paddle.x &&
    ball.x - ball.r < paddle.x + paddle.w &&
    ball.y + ball.r > paddle.y &&
    ball.y - ball.r < paddle.y + paddle.h
  );
}

function removePlayer(ws) {
  for (const [code, room] of rooms.entries()) {
    const idx = room.players.findIndex(p => p.ws === ws);
    if (idx !== -1) {
      const leaving = room.players[idx];
      room.players.splice(idx, 1);

      broadcast(room, 'player_left', {
        side: leaving.side
      });

      if (room.players.length === 0) {
        rooms.delete(code);
      } else {
        room.state.phase = 'waiting';
        broadcast(room, 'room_state', {
          code: room.code,
          phase: room.state.phase
        });
      }
      return;
    }
  }
}

wss.on('connection', (ws) => {
  send(ws, 'connected', { ok: true });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'create_room') {
      let room = makeRoom();
      while (rooms.has(room.code)) {
        room = makeRoom();
      }

      room.players.push({
        ws,
        side: 'p1',
        name: msg.name || 'PLAYER 1'
      });

      rooms.set(room.code, room);

      send(ws, 'room_joined', {
        code: room.code,
        side: 'p1',
        host: true
      });

      return;
    }

    if (msg.type === 'join_room') {
      const room = rooms.get((msg.code || '').toUpperCase());
      if (!room) {
        send(ws, 'join_error', { message: 'Room not found' });
        return;
      }

      if (room.players.length >= 2) {
        send(ws, 'join_error', { message: 'Room full' });
        return;
      }

      room.players.push({
        ws,
        side: 'p2',
        name: msg.name || 'PLAYER 2'
      });

      send(ws, 'room_joined', {
        code: room.code,
        side: 'p2',
        host: false
      });

      broadcast(room, 'room_ready', {
        code: room.code,
        players: room.players.map(p => ({ side: p.side, name: p.name }))
      });

      return;
    }

    if (msg.type === 'start_match') {
      const room = [...rooms.values()].find(r => r.players.some(p => p.ws === ws));
      if (!room) return;
      if (room.players.length < 2) return;

      room.state.phase = 'playing';
      room.state.score1 = 0;
      room.state.score2 = 0;
      room.state.paddles.p1.x = ARENA_W / 2 - PADDLE_WIDTH / 2;
      room.state.paddles.p2.x = ARENA_W / 2 - PADDLE_WIDTH / 2;
      resetBall(room, 1);

      broadcast(room, 'match_started', {
        code: room.code
      });

      return;
    }

    if (msg.type === 'input') {
      const room = [...rooms.values()].find(r => r.players.some(p => p.ws === ws));
      if (!room) return;

      const player = room.players.find(p => p.ws === ws);
      if (!player) return;

      room.state.inputs[player.side] = {
        left: !!msg.left,
        right: !!msg.right,
        ability: !!msg.ability
      };

      return;
    }
  });

  ws.on('close', () => removePlayer(ws));
  ws.on('error', () => removePlayer(ws));
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.state.phase !== 'playing') continue;

    const s = room.state;
    const p1 = s.paddles.p1;
    const p2 = s.paddles.p2;
    const i1 = s.inputs.p1;
    const i2 = s.inputs.p2;
    const b = s.ball;

    if (i1.left) p1.x -= PADDLE_SPEED;
    if (i1.right) p1.x += PADDLE_SPEED;
    if (i2.left) p2.x -= PADDLE_SPEED;
    if (i2.right) p2.x += PADDLE_SPEED;

    p1.x = clamp(p1.x, 0, s.width - p1.w);
    p2.x = clamp(p2.x, 0, s.width - p2.w);

    b.x += b.vx;
    b.y += b.vy;

    if (b.x - b.r <= 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
    }
    if (b.x + b.r >= s.width) {
      b.x = s.width - b.r;
      b.vx = -Math.abs(b.vx);
    }

    if (hits(b, p1) && b.vy > 0) {
      const hitPoint = (b.x - (p1.x + p1.w / 2)) / (p1.w / 2);
      b.vx = hitPoint * 6;
      b.vy = -Math.abs(b.vy);
      b.y = p1.y - b.r - 1;
    }

    if (hits(b, p2) && b.vy < 0) {
      const hitPoint = (b.x - (p2.x + p2.w / 2)) / (p2.w / 2);
      b.vx = hitPoint * 6;
      b.vy = Math.abs(b.vy);
      b.y = p2.y + p2.h + b.r + 1;
    }

    if (b.y < 0) {
      s.score1 += 1;
      if (s.score1 >= SCORE_TO_WIN) {
        s.phase = 'gameover';
        broadcast(room, 'match_over', { winner: 'p1', score1: s.score1, score2: s.score2 });
      } else {
        resetBall(room, 1);
      }
    }

    if (b.y > s.height) {
      s.score2 += 1;
      if (s.score2 >= SCORE_TO_WIN) {
        s.phase = 'gameover';
        broadcast(room, 'match_over', { winner: 'p2', score1: s.score1, score2: s.score2 });
      } else {
        resetBall(room, -1);
      }
    }

    broadcast(room, 'state', {
      phase: s.phase,
      score1: s.score1,
      score2: s.score2,
      paddles: s.paddles,
      ball: s.ball
    });
  }
}, TICK_RATE);

console.log(`Battle Pong server running on port ${PORT}`);
