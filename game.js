'use strict';

const STAT_BUDGET = 200;
const STAT_MAX = 80;
const SCORE_TO_WIN = 5;
const BALL_BASE_SPD = 5; // Spiced up the speed
const AI_REACTION = 0.072;

const FACTION = {
    cyan: { name: 'VANGUARD', color: '#00f5ff', glow: 'rgba(0,245,255,0.6)' },
    red:  { name: 'DOMINION', color: '#ff2d55', glow: 'rgba(255,45,85,0.6)' }
};

const STAT_DEFS = [
    { key: 'POW', label: 'POWER',  desc: 'Ball speed on hit',     defaultVal: 30 },
    { key: 'SPD', label: 'SPEED',  desc: 'Paddle movement speed', defaultVal: 35 },
    { key: 'SIZ', label: 'SIZE',   desc: 'Paddle height & width', defaultVal: 35 },
    { key: 'INT', label: 'INTEL',  desc: 'Mana pool',             defaultVal: 35 }
];

let GS = {
    phase: 'faction',
    faction: 'cyan',
    playerStats: {},
    player: null, enemy: null, ball: null,
    round: 1,
    input: { left: false, right: false }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    GS.phase = name;
}

function resizeCanvas() {
    const hud = document.getElementById('hud-top');
    const controls = document.getElementById('mobile-controls');
    const usedH = hud.offsetHeight + controls.offsetHeight + 40;
    
    canvas.width = Math.min(window.innerWidth, 480);
    canvas.height = window.innerHeight - usedH;
}

// THE FIX: Wait for layout before spawning paddles
function startMatch() {
    showScreen('game');
    
    // Give browser 100ms to render the 'game' screen so canvas has a real height
    setTimeout(() => {
        resizeCanvas();
        
        const pStats = GS.playerStats;
        const eStats = { POW: 40, SPD: 40, SIZ: 40, INT: 40 };

        GS.player = {
            x: canvas.width / 2 - 40,
            y: canvas.height - 30,
            w: 60 + (pStats.SIZ * 0.7),
            h: 12,
            speed: 3.5 + (pStats.SPD * 0.1),
            color: FACTION[GS.faction].color,
            score: 0,
            xp: 0, lvl: 1, maxHp: 3, hp: 3
        };

        GS.enemy = {
            x: canvas.width / 2 - 40,
            y: 30,
            w: 80, h: 12,
            speed: 4,
            color: GS.faction === 'cyan' ? FACTION.red.color : FACTION.cyan.color,
            score: 0, maxHp: 3, hp: 3
        };

        GS.ball = initBall();
        console.log("Match Started. Canvas Height:", canvas.height);
    }, 100);
}

function initBall() {
    return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: 4,
        r: 7
    };
}

function update() {
    if (GS.phase !== 'game' || !GS.player) return;

    const p = GS.player;
    const e = GS.enemy;
    const b = GS.ball;

    // Player Move
    if (GS.input.left) p.x -= p.speed;
    if (GS.input.right) p.x += p.speed;
    p.x = Math.max(0, Math.min(canvas.width - p.w, p.x));

    // AI Move
    let aiTarget = b.x - e.w / 2;
    e.x += (aiTarget - e.x) * AI_REACTION;
    e.x = Math.max(0, Math.min(canvas.width - e.w, e.x));

    // Ball move
    b.x += b.vx;
    b.y += b.vy;

    // Walls
    if (b.x < b.r || b.x > canvas.width - b.r) b.vx *= -1;

    // Paddle Hit Logic (Nudge fixed)
    if (b.y + b.r > p.y && b.x > p.x && b.x < p.x + p.w && b.y < p.y + p.h) {
        b.vy = -Math.abs(b.vy) - 0.2;
        b.y = p.y - b.r - 2;
        b.vx = ((b.x - (p.x + p.w/2)) / (p.w/2)) * 7;
        p.xp += 5;
    }

    if (b.y - b.r < e.y + e.h && b.x > e.x && b.x < e.x + e.w && b.y > e.y) {
        b.vy = Math.abs(b.vy) + 0.2;
        b.y = e.y + e.h + b.r + 2;
        b.vx = ((b.x - (e.x + e.w/2)) / (e.w/2)) * 7;
    }

    // Scoring
    if (b.y < 0) { p.score++; GS.ball = initBall(); updateHUD(); }
    if (b.y > canvas.height) { e.score++; GS.ball = initBall(); updateHUD(); }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!GS.player) return;

    // Draw Ball
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(GS.ball.x, GS.ball.y, GS.ball.r, 0, Math.PI*2);
    ctx.fill();

    // Draw Paddles
    ctx.fillStyle = GS.player.color;
    ctx.fillRect(GS.player.x, GS.player.y, GS.player.w, GS.player.h);
    ctx.fillStyle = GS.enemy.color;
    ctx.fillRect(GS.enemy.x, GS.enemy.y, GS.enemy.w, GS.enemy.h);
}

function updateHUD() {
    document.getElementById('score-player').innerText = GS.player.score;
    document.getElementById('score-enemy').innerText = GS.enemy.score;
    document.getElementById('xp-val').innerText = GS.player.xp;
}

// Logic to build the sliders
function buildStatScreen() {
    const container = document.getElementById('stat-sliders');
    container.innerHTML = '';
    STAT_DEFS.forEach(def => {
        GS.playerStats[def.key] = def.defaultVal;
        container.innerHTML += `
            <div class="stat-row">
                <label class="stat-label">${def.key}</label>
                <input type="range" class="stat-slider" data-key="${def.key}" min="10" max="80" value="${def.defaultVal}">
                <span class="stat-val" id="v-${def.key}">${def.defaultVal}</span>
            </div>`;
    });
    
    // Add listeners to sliders
    document.querySelectorAll('.stat-slider').forEach(s => {
        s.oninput = (e) => {
            const key = e.target.dataset.key;
            GS.playerStats[key] = parseInt(e.target.value);
            document.getElementById(`v-${key}`).innerText = e.target.value;
        }
    });
}

// NAVIGATION
document.getElementById('card-cyan').onclick = () => { GS.faction = 'cyan'; showScreen('stats'); buildStatScreen(); };
document.getElementById('card-red').onclick = () => { GS.faction = 'red'; showScreen('stats'); buildStatScreen(); };
document.getElementById('confirm-stats').onclick = () => startMatch();

// CONTROLS
const setupBtn = (id, key) => {
    const el = document.getElementById(id);
    el.ontouchstart = (e) => { e.preventDefault(); GS.input[key] = true; };
    el.ontouchend = () => GS.input[key] = false;
};
setupBtn('btn-move-left', 'left');
setupBtn('btn-move-right', 'right');

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();
