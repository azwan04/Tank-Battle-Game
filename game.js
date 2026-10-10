
"use strict";

// ============================================
// TANK BATTLE 1990
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

const bossPanel = document.getElementById("boss-panel");
const bossHealthFill = document.getElementById("boss-health-fill");
const bossHealthText = document.getElementById("boss-health-text");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TANK_SIZE = 28;

const STARTING_LIVES = 3;
const MAX_LIVES = 5;
const BOSS_SCORE = 1000;
const BOSS_MAX_HEALTH = 20;
const POWERUP_SIZE = 22;
const POWERUP_INTERVAL = 9000;

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
let bullets = [];
let walls = [];
let boss = null;
let powerup = null;

let keys = {};
let lastTime = 0;
let enemySpawnTimer = 0;
let powerupTimer = 0;
let bossWarningShown = false;

// ============================================
// BATTLEFIELD
// ============================================

function createWorld() {
    walls = [
        { x: 90, y: 65, w: 40, h: 40 },
        { x: 150, y: 65, w: 40, h: 40 },
        { x: 410, y: 65, w: 40, h: 40 },
        { x: 470, y: 65, w: 40, h: 40 },

        { x: 250, y: 120, w: 40, h: 40 },
        { x: 310, y: 120, w: 40, h: 40 },

        { x: 90, y: 190, w: 40, h: 40 },
        { x: 470, y: 190, w: 40, h: 40 },

        { x: 190, y: 250, w: 40, h: 40 },
        { x: 370, y: 250, w: 40, h: 40 },

        { x: 270, y: 310, w: 40, h: 40 }
    ];
}

function createPlayer() {
    return {
        x: 286,
        y: 350,
        size: TANK_SIZE,
        speed: 1.8,
        direction: "up",
        color: "#65d65e",
        shootCooldown: 0,
        invulnerable: 0
    };
}

// ============================================
// START AND RESTART
// ============================================

function resetGame() {
    score = 0;
    lives = STARTING_LIVES;

    enemies = [];
    bullets = [];
    boss = null;
    powerup = null;

    enemySpawnTimer = 0;
    powerupTimer = 0;
    bossWarningShown = false;
    keys = {};

    createWorld();
    player = createPlayer();

    spawnEnemy(30, 25);
    spawnEnemy(270, 25);
    spawnEnemy(530, 25);

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

function endGame(won) {
    if (state === "won" || state === "lost") {
        return;
    }

    state = won ? "won" : "lost";
    keys = {};

    if (won) {
        showScreen(
            "YOU WIN!",
            "You defeated the Boss! Final score: " + score,
            "PLAY AGAIN"
        );
    } else {
        showScreen(
            "GAME OVER",
            "You have lost all your lives. Final score: " + score,
            "TRY AGAIN"
        );
    }
}

function startBossFight() {
    boss = {
        x: WIDTH / 2 - 30,
        y: 35,
        size: 60,
        speed: 0.7,
        direction: "down",
        color: "#a53dca",
        hp: BOSS_MAX_HEALTH,
        shootCooldown: 800
    };

    enemies = [];
    bullets = [];
    powerup = null;

    state = "playing";
    screen.classList.add("hidden");

    updateHUD();
}

function checkBossThreshold() {
    if (
        score >= BOSS_SCORE &&
        boss === null &&
        !bossWarningShown
    ) {
        bossWarningShown = true;
        enemies = [];
        bullets = [];
        powerup = null;
        state = "boss-warning";

        showScreen(
            "THE BOSS IS HERE!",
            "You reached 1000 points! Prepare for the final battle.",
            "FIGHT BOSS"
        );
    }
}

// ============================================
// COLLISION DETECTION
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

    for (const wall of walls) {
        if (overlaps(test, wall)) {
            return false;
        }
    }

    if (tank !== player && player && overlaps(test, player)) {
        return false;
    }

    for (const enemy of enemies) {
        if (enemy !== tank && overlaps(test, enemy)) {
            return false;
        }
    }

    if (boss && boss !== tank && overlaps(test, boss)) {
        return false;
    }

    return true;
}

// ============================================
// ENEMY TANKS
// ============================================

function spawnEnemy(x, y) {
    const enemy = {
        x: x,
        y: y,
        size: TANK_SIZE,
        speed: 0.75 + Math.random() * 0.2,
        direction: "down",
        color: "#e65b4f",
        shootCooldown: 900 + Math.random() * 700,
        turnTimer: 500 + Math.random() * 900,
        hp: 1
    };

    if (canMove(enemy, x, y)) {
        enemies.push(enemy);
    }
}

function chooseDirectionToPlayer(tank) {
    const playerX = player.x + player.size / 2;
    const playerY = player.y + player.size / 2;
    const tankX = tank.x + tank.size / 2;
    const tankY = tank.y + tank.size / 2;

    if (Math.abs(playerX - tankX) > Math.abs(playerY - tankY)) {
        return playerX < tankX ? "left" : "right";
    }

    return playerY < tankY ? "up" : "down";
}

function moveEnemies(delta) {
    for (const enemy of enemies) {
        enemy.shootCooldown -= delta;
        enemy.turnTimer -= delta;

        if (enemy.turnTimer <= 0) {
            const options = ["up", "down", "left", "right"];
            enemy.direction =
                options[Math.floor(Math.random() * options.length)];

            enemy.turnTimer = 700 + Math.random() * 900;
        }

        const direction = directions[enemy.direction];
        const distance = enemy.speed * delta / 16.67;

        const nextX = enemy.x + direction.x * distance;
        const nextY = enemy.y + direction.y * distance;

        if (canMove(enemy, nextX, nextY)) {
            enemy.x = nextX;
            enemy.y = nextY;
        } else {
            enemy.turnTimer = 0;
        }

        if (enemy.shootCooldown <= 0) {
            enemy.direction = chooseDirectionToPlayer(enemy);
            shoot(enemy, "enemy");
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

    if (dx !== 0 && canMove(player, player.x + dx * distance, player.y)) {
        player.x += dx * distance;
    }

    if (dy !== 0 && canMove(player, player.x, player.y + dy * distance)) {
        player.y += dy * distance;
    }

    if (keys.space) {
        shoot(player, "player");
    }
}

// ============================================
// SHOOTING
// ============================================

function shoot(tank, owner) {
    if (tank.shootCooldown > 0) {
        return;
    }

    if (owner === "player") {
        tank.shootCooldown = 300;
    } else if (owner === "boss") {
        tank.shootCooldown = 1100;
    } else {
        tank.shootCooldown = 1500;
    }

    const direction = directions[tank.direction];
    const bulletSize = owner === "boss" ? 9 : 6;
    const bulletSpeed = owner === "player" ? 5 : 3;
    const center = tank.size / 2;

    bullets.push({
        x: tank.x + center - bulletSize / 2 +
            direction.x * (center + 2),
        y: tank.y + center - bulletSize / 2 +
            direction.y * (center + 2),
        w: bulletSize,
        h: bulletSize,
        vx: direction.x * bulletSpeed,
        vy: direction.y * bulletSpeed,
        owner: owner,
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
            bullet.x < 0 ||
            bullet.y < 0 ||
            bullet.x + bullet.w > WIDTH ||
            bullet.y + bullet.h > HEIGHT
        ) {
            return false;
        }

        return !walls.some(wall => overlaps(bullet, wall));
    });
}

// ============================================
// RANDOM EXTRA-LIFE POWER-UP
// ============================================

function spawnPowerup() {
    if (powerup || lives >= MAX_LIVES || boss) {
        return;
    }

    for (let attempt = 0; attempt < 80; attempt++) {
        const x = 20 + Math.random() * (WIDTH - POWERUP_SIZE - 40);
        const y = 20 + Math.random() * (HEIGHT - POWERUP_SIZE - 40);

        const candidate = {
            x: x,
            y: y,
            size: POWERUP_SIZE
        };

        const blockedByWall = walls.some(wall =>
            overlaps(candidate, wall)
        );

        const blockedByPlayer = player && overlaps(candidate, player);
        const blockedByEnemy = enemies.some(enemy =>
            overlaps(candidate, enemy)
        );

        if (!blockedByWall && !blockedByPlayer && !blockedByEnemy) {
            powerup = candidate;
            return;
        }
    }
}

function updatePowerup(delta) {
    if (lives >= MAX_LIVES || boss) {
        powerup = null;
        powerupTimer = 0;
        return;
    }

    if (!powerup) {
        powerupTimer += delta;

        if (powerupTimer >= POWERUP_INTERVAL) {
            powerupTimer = 0;
            spawnPowerup();
        }
    }

    if (powerup && overlaps(player, powerup)) {
        if (lives < MAX_LIVES) {
            lives++;
            powerup = null;
            powerupTimer = 0;
            updateHUD();
        }
    }
}

function drawPowerup() {
    if (!powerup) {
        return;
    }

    const cx = powerup.x + powerup.size / 2;
    const cy = powerup.y + powerup.size / 2;

    ctx.save();
    ctx.fillStyle = "#ff3b5c";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    // Draw a heart shape.
    ctx.beginPath();
    ctx.moveTo(cx, cy + 8);
    ctx.bezierCurveTo(
        cx - 14, cy - 1,
        cx - 10, cy - 11,
        cx - 3, cy - 7
    );
    ctx.bezierCurveTo(
        cx, cy - 5,
        cx, cy - 3,
        cx, cy - 3
    );
    ctx.bezierCurveTo(
        cx + 5, cy - 13,
        cx + 14, cy - 5,
        cx + 10, cy + 1
    );
    ctx.lineTo(cx, cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// ============================================
// BOSS
// ============================================

function moveBoss(delta) {
    if (!boss) {
        return;
    }

    boss.shootCooldown -= delta;

    const direction = directions[boss.direction];
    const distance = boss.speed * delta / 16.67;

    const nextX = boss.x + direction.x * distance;
    const nextY = boss.y + direction.y * distance;

    if (canMove(boss, nextX, nextY)) {
        boss.x = nextX;
        boss.y = nextY;
    } else {
        boss.direction = chooseDirectionToPlayer(boss);
    }

    if (boss.shootCooldown <= 0) {
        boss.direction = chooseDirectionToPlayer(boss);
        shoot(boss, "boss");
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

    // The player tank does NOT respawn.
    // It stays at the position where it was hit.
    if (lives <= 0) {
        lives = 0;
        updateHUD();
        endGame(false);
        return;
    }

    // Brief protection to prevent repeated instant damage.
    player.invulnerable = 1500;

    // Remove enemy bullets after the player is hit.
    bullets = bullets.filter(bullet => bullet.owner === "player");

    updateHUD();
}

function checkCollisions() {
    for (const bullet of bullets) {
        if (bullet.hit) {
            continue;
        }

        if (bullet.owner === "player") {
            for (const enemy of enemies) {
                if (overlaps(bullet, enemy)) {
                    enemy.hp = 0;
                    bullet.hit = true;
                    break;
                }
            }

            if (!bullet.hit && boss && overlaps(bullet, boss)) {
                boss.hp--;
                bullet.hit = true;

                if (boss.hp <= 0) {
                    boss.hp = 0;
                    updateHUD();
                    endGame(true);
                    return;
                }
            }
        } else if (
            player.invulnerable <= 0 &&
            overlaps(bullet, player)
        ) {
            bullet.hit = true;
            loseLife();

            if (state !== "playing") {
                return;
            }
        }
    }

    bullets = bullets.filter(bullet => !bullet.hit);

    const defeated = enemies.filter(enemy => enemy.hp <= 0);

    if (defeated.length > 0) {
        // Each defeated enemy gives 100 points.
        score += defeated.length * 100;

        enemies = enemies.filter(enemy => enemy.hp > 0);

        checkBossThreshold();

        if (state !== "playing") {
            return;
        }
    }

    for (const enemy of enemies) {
        if (
            player.invulnerable <= 0 &&
            overlaps(player, enemy)
        ) {
            loseLife();

            if (state !== "playing") {
                return;
            }

            break;
        }
    }

    if (powerup && overlaps(player, powerup)) {
        if (lives < MAX_LIVES) {
            lives++;
            powerup = null;
            powerupTimer = 0;
            updateHUD();
        }
    }
}

// ============================================
// DRAW THE BATTLEFIELD
// ============================================

function drawWorld() {
    ctx.fillStyle = "#354c36";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ground pattern. No grass or camouflage.
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
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
    ctx.fillStyle = "#9b6544";
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.strokeStyle = "#4f3023";
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

    ctx.strokeStyle = "#5e3928";
    ctx.beginPath();

    ctx.moveTo(wall.x, wall.y + wall.h / 2);
    ctx.lineTo(wall.x + wall.w, wall.y + wall.h / 2);

    ctx.moveTo(wall.x + wall.w / 2, wall.y);
    ctx.lineTo(wall.x + wall.w / 2, wall.y + wall.h / 2);

    ctx.moveTo(wall.x + wall.w / 4, wall.y + wall.h / 2);
    ctx.lineTo(wall.x + wall.w / 4, wall.y + wall.h);

    ctx.moveTo(wall.x + wall.w * 3 / 4, wall.y + wall.h / 2);
    ctx.lineTo(wall.x + wall.w * 3 / 4, wall.y + wall.h);

    ctx.stroke();
}

// ============================================
// TANK GRAPHICS
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

    ctx.translate(
        tank.x + size / 2,
        tank.y + size / 2
    );

    const angles = {
        up: 0,
        right: Math.PI / 2,
        down: Math.PI,
        left: -Math.PI / 2
    };

    ctx.rotate(angles[tank.direction]);

    // Tank tracks.
    ctx.fillStyle = "#151b16";
    ctx.fillRect(
        -size * 0.49,
        -size * 0.46,
        size * 0.98,
        size * 0.92
    );

    ctx.fillStyle = "#69766a";

    for (let i = 0; i < 4; i++) {
        const trackY = -size * 0.36 + i * size * 0.23;

        ctx.fillRect(
            -size * 0.45,
            trackY,
            size * 0.10,
            size * 0.10
        );

        ctx.fillRect(
            size * 0.35,
            trackY,
            size * 0.10,
            size * 0.10
        );
    }

    // Armour.
    ctx.fillStyle = tank.color;
    ctx.fillRect(
        -size * 0.32,
        -size * 0.39,
        size * 0.64,
        size * 0.78
    );

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(
        -size * 0.27,
        size * 0.16,
        size * 0.54,
        size * 0.16
    );

    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillRect(
        -size * 0.25,
        -size * 0.32,
        size * 0.50,
        size * 0.08
    );

    // Turret base.
    ctx.fillStyle = "#263127";
    ctx.fillRect(
        -size * 0.20,
        -size * 0.20,
        size * 0.40,
        size * 0.40
    );

    // Cannon.
    ctx.fillStyle = "#202720";
    ctx.fillRect(
        -size * 0.095,
        -size * 0.60,
        size * 0.19,
        size * 0.47
    );

    ctx.fillStyle = "#a6b2a1";
    ctx.fillRect(
        -size * 0.045,
        -size * 0.57,
        size * 0.045,
        size * 0.36
    );

    // Turret.
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

    // Boss armour.
    if (tank === boss) {
        ctx.strokeStyle = "#f4c8ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            -size * 0.38,
            -size * 0.40,
            size * 0.76,
            size * 0.80
        );
    }

    ctx.restore();
}

function drawBoss() {
    if (!boss) {
        return;
    }

    drawTank(boss);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";

    ctx.fillText(
        "BOSS",
        boss.x + boss.size / 2,
        boss.y - 7
    );
}

function drawBullets() {
    for (const bullet of bullets) {
        ctx.fillStyle =
            bullet.owner === "player" ? "#fff176" : "#ff7777";

        ctx.fillRect(
            bullet.x,
            bullet.y,
            bullet.w,
            bullet.h
        );

        if (bullet.owner === "player") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(
                bullet.x + bullet.w * 0.3,
                bullet.y + bullet.h * 0.3,
                bullet.w * 0.4,
                bullet.h * 0.4
            );
        }
    }
}

// ============================================
// HUD
// ============================================

function updateHUD() {
    scoreText.textContent = score;
    livesText.textContent = lives;
    enemyCountText.textContent = enemies.length;

    if (boss) {
        bossPanel.hidden = false;

        bossHealthText.textContent =
            Math.max(0, boss.hp) + " / " + BOSS_MAX_HEALTH;

        bossHealthFill.style.width =
            (Math.max(0, boss.hp) / BOSS_MAX_HEALTH * 100) + "%";
    } else {
        bossPanel.hidden = true;
    }
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
        moveBoss(delta);
        moveBullets(delta);
        updatePowerup(delta);
        checkCollisions();

        if (state === "playing" && !boss) {
            enemySpawnTimer += delta;

            if (enemySpawnTimer >= 1800 && enemies.length < 4) {
                enemySpawnTimer = 0;

                const positions = [
                    [30, 25],
                    [270, 25],
                    [530, 25]
                ];

                for (const position of positions) {
                    if (enemies.length >= 4) {
                        break;
                    }

                    const previousCount = enemies.length;

                    spawnEnemy(position[0], position[1]);

                    if (enemies.length > previousCount) {
                        break;
                    }
                }
            }
        }
    }

    drawWorld();
    drawPowerup();
    drawBullets();

    enemies.forEach(drawTank);

    if (player) {
        drawTank(player);
    }

    drawBoss();
    updateHUD();

    requestAnimationFrame(gameLoop);
}

// ============================================
// START AND RESTART BUTTON
// ============================================

screenButton.addEventListener("click", function () {
    if (state === "boss-warning") {
        startBossFight();
    } else {
        resetGame();
    }
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
// MOBILE DIRECTION BUTTONS
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
    "Defeat enemies, reach 1000 points and fight the Boss!",
    "START GAME"
);

updateHUD();
requestAnimationFrame(gameLoop);
