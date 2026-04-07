const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Set canvas to mobile-friendly aspect ratio
canvas.width = window.innerWidth > 400 ? 400 : window.innerWidth - 20;
canvas.height = window.innerHeight * 0.7;

const game = {
    ball: { 
        x: canvas.width / 2, y: canvas.height / 2, 
        vx: 3, vy: 3, radius: 8, speed: 4 
    },
    p1: { // Player/Bottom
        x: canvas.width / 2 - 40, y: canvas.height - 30,
        w: 80, h: 15, color: '#00ffcc', 
        speed: 5, score: 0, 
        stats: { paddleSizeMult: 1, speedBoost: 0 } 
    },
    p2: { // AI/Top
        x: canvas.width / 2 - 40, y: 20,
        w: 80, h: 15, color: '#ff4444', 
        speed: 3, score: 0 
    }
};

function update() {
    // 1. Move Ball
    game.ball.x += game.ball.vx;
    game.ball.y += game.ball.vy;

    // 2. Wall Bouncing (Left/Right)
    if (game.ball.x <= 0 || game.ball.x >= canvas.width) game.ball.vx *= -1;

    // 3. Simple AI (Opponent)
    let aiTarget = game.ball.x - game.p2.w / 2;
    game.p2.x += (aiTarget - game.p2.x) * 0.1; // Smooth easing

    // 4. Collision Detection
    checkCollision(game.p1);
    checkCollision(game.p2);

    // 5. Scoring
    if (game.ball.y < 0) { resetBall(); game.p1.score++; }
    if (game.ball.y > canvas.height) { resetBall(); game.p2.score++; }
}

function checkCollision(paddle) {
    if (game.ball.x > paddle.x && game.ball.x < paddle.x + paddle.w) {
        if (Math.abs(game.ball.y - paddle.y) < paddle.h) {
            game.ball.vy *= -1;
            // Add a little flavor based on where it hit the paddle
            let impact = (game.ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
            game.ball.vx = impact * 5; 
        }
    }
}

function resetBall() {
    game.ball.x = canvas.width / 2;
    game.ball.y = canvas.height / 2;
    game.ball.vy *= -1;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Paddles
    ctx.fillStyle = game.p1.color;
    ctx.fillRect(game.p1.x, game.p1.y, game.p1.w, game.p1.h);
    
    ctx.fillStyle = game.p2.color;
    ctx.fillRect(game.p2.x, game.p2.y, game.p2.w, game.p2.h);
    
    // Draw Ball
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.closePath();

    document.getElementById('p1-score').innerText = game.p1.score;
    document.getElementById('p2-score').innerText = game.p2.score;
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
