
"use strict";

// ============================================
// TANK BATTLE 1990 - ENDLESS BATTLE
// ============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("score");
const livesText = document.getElementById("lives");
const enemyCountText = document.getElementById("enemy-count");

const screen = document.getElementById("screen");
const screenTitle = document.getElementById("screen-title");
const screenMessage = document.getElementById("screen-message");
const screenButton = document.getElementById("screen-button");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TANK_SIZE = 28;

const STARTING_LIVES = 3;
const MAX_LIVES = 5;
const MAX_ALLIES = 3;
const MAX_ENEMIES = 5;
const POWERUP_INTERVAL = 8000;

const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

let state = "start";
let score = 0;
let lives = STARTING_LIVES;

let player = null;
let enemies = [];
let allies = [];
let bullets = [];
let walls = [];
let powerups = [];

let keys = {};
let lastTime = 0;
let enemySpawnTimer = 0;
let powerupTimer = 0;
let nextPowerupType = "life";

// ============================================
// WORLD - ORIGINAL WALL DESIGN
// ============================================

function createWorld() {
    walls = [
        { x: 90, y: 65, w: 60, h: 30 },
        { x: 90, y: 65, w: 30, h: 70 },
        { x: 150, y: 105, w: 30, h: 50 },

        { x: 420, y: 65, w: 90, h: 30 },
        { x: 480, y: 65, w: 30, h: 70 },
        { x: 420, y: 125, w: 30, h: 40 },

        { x: 230, y: 90, w: 50, h: 30 },
        { x: 320, y: 90, w: 50, h: 30 },

        { x: 70, y: 210, w: 30, h: 70 },
        { x: 100, y: 250, w: 50, h: 30 },
        { x: 500, y: 210, w: 30, h: 70 },
        { x: 450, y: 250, w: 50, h: 30 },

        { x: 220, y: 190, w: 50, h: 30 },
        { x: 330, y: 190, w: 50, h: 30 },
        { x: 280, y: 250, w: 40, h: 30 },

        { x: 130, y: 315, w: 60, h: 25 },
        { x: 410, y: 315, w: 60, h: 25 }
    ];
}

function createPlayer() {
    return {
        x: 286,
        y: 355,
        size: TANK_SIZE,
        speed: 2,
        direction: "up",
        color: "#65d65e",
        shootCooldown: 0,
        invulnerable: 0,
        hp: 1,
        type: "player"
    };
}

// ============================================
// GAME START AND RESTART
// ============================================

function resetGame() {
    score = 0;
    lives = STARTING_LIVES;

    enemies = [];
    allies = [];
    bullets = [];
    powerups = [];

    enemySpawnTimer = 0;
    powerupTimer = 0;
    nextPowerupType = "life";
    keys = {};

    createWorld();
    player = createPlayer();

    spawnEnemy(25, 20);
    spawnEnemy(285, 20);
    spawnEnemy(545, 20);

    state = "playing";
    screen.classList.add("hidden");
    updateHUD();
}

function showScreen(title, message, buttonText) {
    screenTitle.textContent = title;
    screenMessage.textContent = message;
    screenButton.textContent = buttonText;
    screen.classList.remove("hidden");
}

function endGame() {
    if (state !== "playing") return;

    state = "lost";
    keys = {};

    showScreen(
        "GAME OVER",
        "Final score: " + score + " points!",
        "PLAY AGAIN"
    );
}

// ============================================
// COLLISION
// ============================================

function overlaps(a, b) {
    const aw = a.w !== undefined ? a.w : a.size;
    const ah = a.h !== undefined ? a.h : a.size;
    const bw = b.w !== undefined ? b.w : b.size;
    const bh = b.h !== undefined ? b.h : b.size;

    return (
        a.x < b.x + bw &&
        a.x + aw > b.x &&
        a.y < b.y + bh &&
        a.y + ah > b.y
    );
}

function canMove(tank, newX, newY) {
    const test = {
        x: newX,
        y: newY,
        size: tank.size
    };

    if (
        newX < 0 ||
        newY < 0 ||
        newX + tank.size > WIDTH ||
        newY + tank.size > HEIGHT
    ) {
        return false;
    }

    if (walls.some(wall => overlaps(test, wall))) {
        return false;
    }

    const otherTanks = [player, ...enemies, ...allies].filter(
        other => other && other !== tank
    );

    if (otherTanks.some(other => overlaps(test, other))) {
        return false;
    }

    return true;
}

// ============================================
// ENEMY TANKS - MAXIMUM 5
// ============================================

function spawnEnemy(x, y) {
    if (enemies.length >= MAX_ENEMIES) return;

    const difficulty = Math.min(score / 1500, 1);

    const enemy = {
        x,
        y,
        size: TANK_SIZE,
        speed: 0.8 + Math.random() * 0.25 + difficulty * 0.65,
        direction: "down",
        color: "#e65b4f",
        shootCooldown: 700 + Math.random() * 900 - difficulty * 350,
        turnTimer: 400 + Math.random() * 800,
        hp: 1,
        type: "enemy"
    };

    if (canMove(enemy, x, y)) {
        enemies.push(enemy);
    }
}

function chooseDirectionToTarget(tank, target) {
    const dx = target.x - tank.x;
    const dy = target.y - tank.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        return dx < 0 ? "left" : "right";
    }

    return dy < 0 ? "up" : "down";
}

function moveEnemies(delta) {
    for (const enemy of enemies) {
        enemy.shootCooldown -= delta;
        enemy.turnTimer -= delta;

        if (enemy.turnTimer <= 0) {
            const options = ["up", "down", "left", "right"];
            const difficulty = Math.min(score / 1500, 1);

            // Musuh semakin bijak menghala kepada pemain.
            if (Math.random() < 0.25 + difficulty * 0.65) {
                enemy.direction = chooseDirectionToTarget(enemy, player);
            } else {
                enemy.direction =
                    options[Math.floor(Math.random() * options.length)];
            }

            enemy.turnTimer =
                700 - difficulty * 300 + Math.random() * 500;
        }

        const direction = directions[enemy.direction];
        const distance = enemy.speed * delta / 16.67;

        const nx = enemy.x + direction.x * distance;
        const ny = enemy.y + direction.y * distance;

        if (canMove(enemy, nx, ny)) {
            enemy.x = nx;
            enemy.y = ny;
        } else {
            enemy.turnTimer = 0;
        }

        if (enemy.shootCooldown <= 0) {
            enemy.direction = chooseDirectionToTarget(enemy, player);
            shoot(enemy, "enemy");
        }
    }
}

 // ============================================
 // TEAM REINFORCEMENT
 // ============================================

function spawnAlly() {
    if (allies.length >= MAX_ALLIES) return;

    const positions = [
        { x: 220, y: 350 },
        { x: 350, y: 350 },
        { x: 285, y: 300 },
        { x: 220, y: 300 },
        { x: 350, y: 300 }
    ];

    for (const pos of positions) {
        const ally = {
            x: pos.x,
            y: pos.y,
            size: TANK_SIZE,
            speed: 1.25,
            direction: "up",
            color: "#55baff",
            shootCooldown: 300,
            hp: 3,
            type: "ally",
            targetTimer: 0
        };

        if (canMove(ally, ally.x, ally.y)) {
            allies.push(ally);
            return;
        }
    }
}

function moveAllies(delta) {
    for (const ally of allies) {
        ally.shootCooldown -= delta;
        ally.targetTimer -= delta;

        if (enemies.length === 0) continue;

        const target = enemies.reduce((closest, enemy) => {
            const distance = Math.hypot(
                enemy.x - ally.x,
                enemy.y - ally.y
            );

            if (!closest || distance < closest.distance) {
                return { enemy, distance };
            }

            return closest;
        }, null);

        if (!target) continue;

        const enemy = target.enemy;

        if (ally.targetTimer <= 0) {
            ally.direction = chooseDirectionToTarget(ally, enemy);
            ally.targetTimer = 500;
        }

        const dir = directions[ally.direction];
        const distance = ally.speed * delta / 16.67;

        const nx = ally.x + dir.x * distance;
        const ny = ally.y + dir.y * distance;

        if (canMove(ally, nx, ny)) {
            ally.x = nx;
            ally.y = ny;
        } else {
            ally.targetTimer = 0;
        }

        if (ally.shootCooldown <= 0) {
            ally.direction = chooseDirectionToTarget(ally, enemy);
            shoot(ally, "ally");
        }
    }
}

// ============================================
// PLAYER MOVEMENT
// ============================================

function movePlayer(delta) {
    if (player.shootCooldown > 0) {
        player.shootCooldown -= delta;
    }

    if (player.invulnerable > 0) {
        player.invulnerable -= delta;
    }

    let dx = 0;
    let dy = 0;

    if (keys.arrowup || keys.w) {
        dy = -1;
        player.direction = "up";
    } else if (keys.arrowdown || keys.s) {
        dy = 1;
        player.direction = "down";
    } else if (keys.arrowleft || keys.a) {
        dx = -1;
        player.direction = "left";
    } else if (keys.arrowright || keys.d) {
        dx = 1;
        player.direction = "right";
    }

    const distance = player.speed * delta / 16.67;

    if (dx && canMove(player, player.x + dx * distance, player.y)) {
        player.x += dx * distance;
    }

    if (dy && canMove(player, player.x, player.y + dy * distance)) {
        player.y += dy * distance;
    }

    if (keys.space) {
        shoot(player, "player");
    }
}

// ============================================
// BULLETS
// ============================================

function shoot(tank, owner) {
    if (tank.shootCooldown > 0) return;

    const difficulty = Math.min(score / 1500, 1);

    tank.shootCooldown = owner === "player" ? 300 :
        owner === "ally" ? 550 : 1300 - difficulty * 500;

    const direction = directions[tank.direction];
    const bulletSize = 6;
    const center = tank.size / 2;
    const bulletSpeed = owner === "enemy" ? 2.8 : 4.5;

    bullets.push({
        x: tank.x + center - bulletSize / 2 +
            direction.x * (center + 2),
        y: tank.y + center - bulletSize / 2 +
            direction.y * (center + 2),
        w: bulletSize,
        h: bulletSize,
        vx: direction.x * bulletSpeed,
        vy: direction.y * bulletSpeed,
        owner,
        hit: false
    });
}

function moveBullets(delta) {
    for (const bullet of bullets) {
        bullet.x += bullet.vx * delta / 16.67;
        bullet.y += bullet.vy * delta / 16.67;
    }

    bullets = bullets.filter(bullet => {
        if (
            bullet.x < 0 || bullet.y < 0 ||
            bullet.x + bullet.w > WIDTH ||
            bullet.y + bullet.h > HEIGHT
        ) {
            return false;
        }

        return !walls.some(wall => overlaps(bullet, wall));
    });
}

// ============================================
// RANDOM POWER-UPS
// ============================================

function spawnPowerup() {
    if (powerups.length >= 1) return;

    const type = nextPowerupType;
    nextPowerupType = type === "life" ? "team" : "life";

    for (let i = 0; i < 100; i++) {
        const powerup = {
            x: 20 + Math.random() * (WIDTH - 44),
            y: 20 + Math.random() * (HEIGHT - 44),
            size: 24,
            type
        };

        const blocked =
            walls.some(wall => overlaps(powerup, wall)) ||
            [player, ...enemies, ...allies].some(
                tank => tank && overlaps(powerup, tank)
            );

        if (!blocked) {
            powerups.push(powerup);
            return;
        }
    }
}

function updatePowerups(delta) {
    powerupTimer += delta;

    if (powerupTimer >= POWERUP_INTERVAL) {
        powerupTimer = 0;
        spawnPowerup();
    }

    for (const powerup of powerups) {
        if (!overlaps(player, powerup)) continue;

        if (powerup.type === "life") {
            if (lives < MAX_LIVES) {
                lives++;
            }
        } else if (powerup.type === "team") {
            spawnAlly();
        }

        powerup.collected = true;
        updateHUD();
    }

    powerups = powerups.filter(powerup => !powerup.collected);
}

function drawPowerups() {
    for (const powerup of powerups) {
        const cx = powerup.x + powerup.size / 2;
        const cy = powerup.y + powerup.size / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "22px Arial";

        if (powerup.type === "life") {
            ctx.fillText("❤️", cx, cy);
        } else {
            ctx.fillText("🟢", cx, cy);
        }

        ctx.restore();
    }
}

 // ============================================
 // DAMAGE AND COLLISIONS
 // ============================================

function loseLife() {
    if (state !== "playing" || player.invulnerable > 0) {
        return;
    }

    lives--;

    // Player stays at the position where hit.
    if (lives <= 0) {
        lives = 0;
        updateHUD();
        endGame();
        return;
    }

    player.invulnerable = 1500;
    bullets = bullets.filter(bullet => bullet.owner !== "enemy");

    updateHUD();
}

function checkCollisions() {
    for (const bullet of bullets) {
        if (bullet.hit) continue;

        if (bullet.owner === "player" || bullet.owner === "ally") {
            for (const enemy of enemies) {
                if (overlaps(bullet, enemy)) {
                    enemy.hp = 0;
                    bullet.hit = true;
                    break;
                }
            }
        } else if (bullet.owner === "enemy") {
            for (const ally of allies) {
                if (overlaps(bullet, ally)) {
                    // Team tanks lose one life per hit.
                    ally.hp--;
                    bullet.hit = true;
                    break;
                }
            }

            if (
                !bullet.hit &&
                player.invulnerable <= 0 &&
                overlaps(bullet, player)
            ) {
                bullet.hit = true;
                loseLife();

                if (state !== "playing") return;
            }
        }
    }

    bullets = bullets.filter(bullet => !bullet.hit);

    const defeated = enemies.filter(enemy => enemy.hp <= 0);

    if (defeated.length) {
        score += defeated.length * 100;
        enemies = enemies.filter(enemy => enemy.hp > 0);
    }

    allies = allies.filter(ally => ally.hp > 0);

    for (const enemy of enemies) {
        if (
            player.invulnerable <= 0 &&
            overlaps(player, enemy)
        ) {
            loseLife();

            if (state !== "playing") return;
            break;
        }
    }

    updatePowerups(0);
}

// ============================================
// DRAW WORLD AND WALLS
// ============================================

function drawWorld() {
    ctx.fillStyle = "#354c36";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;

    for (let x = 0; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }

    walls.forEach(drawWall);
}

function drawWall(wall) {
    ctx.fillStyle = "#8b6042";
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.strokeStyle = "#34261d";
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

    // Original brick pattern.
    ctx.strokeStyle = "#c18a5f";
    ctx.lineWidth = 1;

    if (wall.w > wall.h) {
        for (let x = wall.x + 20; x < wall.x + wall.w; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, wall.y);
            ctx.lineTo(x, wall.y + wall.h);
            ctx.stroke();
        }
    } else {
        for (let y = wall.y + 20; y < wall.y + wall.h; y += 20) {
            ctx.beginPath();
            ctx.moveTo(wall.x, y);
            ctx.lineTo(wall.x + wall.w, y);
            ctx.stroke();
        }
    }
}

// ============================================
// TANK GRAPHICS - ORIGINAL DESIGN
// ============================================

function drawTank(tank) {
    const size = tank.size;

    if (
        tank === player &&
        player.invulnerable > 0 &&
        Math.floor(performance.now() / 100) % 2 === 0
    ) {
        return;
    }

    ctx.save();
    ctx.translate(tank.x + size / 2, tank.y + size / 2);

    const angles = {
        up: 0,
        right: Math.PI / 2,
        down: Math.PI,
        left: -Math.PI / 2
    };

    ctx.rotate(angles[tank.direction]);

    // Tracks
    ctx.fillStyle = "#151b16";
    ctx.fillRect(-size * 0.49, -size * 0.46,
        size * 0.98, size * 0.92);

    ctx.fillStyle = "#69766a";

    for (let i = 0; i < 4; i++) {
        const ty = -size * 0.36 + i * size * 0.23;
        ctx.fillRect(-size * 0.45, ty, size * 0.10, size * 0.10);
        ctx.fillRect(size * 0.35, ty, size * 0.10, size * 0.10);
    }

    // Armour
    ctx.fillStyle = tank.color;
    ctx.fillRect(-size * 0.32, -size * 0.39,
        size * 0.64, size * 0.78);

    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillRect(-size * 0.25, -size * 0.32,
        size * 0.50, size * 0.08);

    // Turret base
    ctx.fillStyle = "#263127";
    ctx.fillRect(-size * 0.20, -size * 0.20,
        size * 0.40, size * 0.40);

    // Cannon
    ctx.fillStyle = "#202720";
    ctx.fillRect(-size * 0.095, -size * 0.60,
        size * 0.19, size * 0.47);

    // Turret
    ctx.fillStyle = tank.color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#172117";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#c0cbb7";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.075, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Display remaining hearts above friendly tanks.
function drawAllyLives() {
    ctx.save();
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ff5b73";

    for (const ally of allies) {
        ctx.fillText(
            "♥".repeat(Math.max(0, ally.hp)),
            ally.x + ally.size / 2,
            ally.y - 5
        );
    }

    ctx.restore();
}

function drawBullets() {
    for (const bullet of bullets) {
        ctx.fillStyle =
            bullet.owner === "enemy" ? "#ff7777" :
            bullet.owner === "ally" ? "#78d8ff" : "#fff176";

        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }
}

// ============================================
// HUD
// ============================================

function updateHUD() {
    scoreText.textContent = score;
    livesText.textContent = lives;
    enemyCountText.textContent = enemies.length;

    const bossPanel = document.getElementById("boss-panel");
    if (bossPanel) bossPanel.hidden = true;
}

// ============================================
// MAIN GAME LOOP
// ============================================

function gameLoop(time = 0) {
    const delta = Math.min(time - lastTime || 16.67, 40);
    lastTime = time;

    if (state === "playing") {
        movePlayer(delta);
        moveEnemies(delta);
        moveAllies(delta);
        moveBullets(delta);
        updatePowerups(delta);
        checkCollisions();

        // Endless enemies, maximum five at a time.
        if (state === "playing") {
            enemySpawnTimer += delta;

            const spawnDelay = Math.max(
                650,
                1800 - Math.floor(score / 500) * 100
            );

            if (
                enemySpawnTimer >= spawnDelay &&
                enemies.length < MAX_ENEMIES
            ) {
                enemySpawnTimer = 0;

                const positions = [
                    [20, 20],
                    [285, 20],
                    [550, 20],
                    [20, 180],
                    [550, 180]
                ];

                for (let i = 0; i < positions.length; i++) {
                    const pos = positions[
                        Math.floor(Math.random() * positions.length)
                    ];

                    const before = enemies.length;
                    spawnEnemy(pos[0], pos[1]);

                    if (enemies.length > before) break;
                }
            }
        }
    }

    drawWorld();
    drawPowerups();
    drawBullets();

    enemies.forEach(drawTank);
    allies.forEach(drawTank);
    drawAllyLives();

    if (player) drawTank(player);

    updateHUD();
    requestAnimationFrame(gameLoop);
}

// ============================================
// START / RESTART
// ============================================

screenButton.addEventListener("click", function () {
    resetGame();
});

// ============================================
// KEYBOARD CONTROLS
// ============================================

document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();

    if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "]
            .includes(key)
    ) {
        event.preventDefault();
    }

    if (key === " " || event.code === "Space") {
        keys.space = true;
    } else {
        keys[key] = true;
    }
});

document.addEventListener("keyup", function (event) {
    const key = event.key.toLowerCase();

    if (key === " " || event.code === "Space") {
        keys.space = false;
    } else {
        keys[key] = false;
    }
});

window.addEventListener("blur", function () {
    keys = {};
});

// ============================================
// MOBILE MOVE BUTTONS
// ============================================

document.querySelectorAll("[data-key]").forEach(function (button) {
    const key = button.dataset.key;

    button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        keys[key] = true;

        if (button.setPointerCapture) {
            button.setPointerCapture(event.pointerId);
        }
    });

    function stopMoving() {
        keys[key] = false;
    }

    button.addEventListener("pointerup", stopMoving);
    button.addEventListener("pointercancel", stopMoving);
    button.addEventListener("lostpointercapture", stopMoving);
});

// ============================================
// MOBILE FIRE BUTTON
// ============================================

const fireButton = document.getElementById("fire-button");

if (fireButton) {
    fireButton.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        keys.space = true;

        if (fireButton.setPointerCapture) {
            fireButton.setPointerCapture(event.pointerId);
        }
    });

    function stopFiring() {
        keys.space = false;
    }

    fireButton.addEventListener("pointerup", stopFiring);
    fireButton.addEventListener("pointercancel", stopFiring);
    fireButton.addEventListener("lostpointercapture", stopFiring);
}

// ============================================
// INITIALIZE
// ============================================

createWorld();
player = createPlayer();

showScreen(
    "TANK BATTLE 1990",
    "Defeat endless enemies, collect power-ups and survive!",
    "START GAME"
);

updateHUD();
requestAnimationFrame(gameLoop);
