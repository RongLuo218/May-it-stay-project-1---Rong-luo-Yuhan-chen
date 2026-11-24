
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Matter = require("matter-js");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
const {
  Engine,
  World,
  Bodies,
  Query
} = Matter;

const engine = Engine.create();

engine.gravity.y = 1;

const STONES = [
  { name: "Hope", width: 150, height: 48 },
  { name: "Courage", width: 135, height: 43 },
  { name: "Love", width: 120, height: 40 },
  { name: "Trust", width: 108, height: 38 },
  { name: "Peace", width: 98, height: 35 },
  { name: "Together", width: 85, height: 32 },
  { name: "Joy", width: 70, height: 30 }
];

const SPAWN_X = 320;
const SPAWN_Y = 90;

const platformHeights = {
  lake: 345,
  snow: 390,
  land: 350,
  sea: 340
};
let selectedPlace = "lake";

const platform = Bodies.rectangle(
  320,
  platformHeights[selectedPlace],
  360,
  24,
  {
    isStatic: true,
    label: "platform"
  }
);

World.add(engine.world, platform);
let playerA = null;
let playerB = null;

let readyA = false;
let readyB = false;
let bothReady = false;

let currentIndex = 0;

let stoneX = SPAWN_X;
let stoneY = SPAWN_Y;
let stoneAngle = 0;

let stoneState = "held";
let stoneBody = null;

let placedStones = [];

let stableFrames = 0;
let wrongSupportFrames = 0;

let nextStoneTimer = null;
const STABLE_FRAMES = 45;

const WRONG_SUPPORT_FRAMES = 90;

const UNSTABLE_FRAMES = 24;

const MAX_POSITION_DRIFT = 30;

const MAX_ANGLE_DRIFT = 0.45;

const MAX_TOTAL_TILT = 0.55;

const NEXT_STONE_DELAY = 1200;

function getScene() {
  return {
    selectedPlace,
    platformY: platform.position.y,
    currentIndex,
    stoneX,
    stoneY,
    stoneAngle,
    stoneState,
    stones: placedStones.map((item) => ({
      index: item.index,
      x: item.body.position.x,
      y: item.body.position.y,
      angle: item.body.angle
    })),
    readyA,
    readyB,
    bothReady
  };
}

function broadcastScene() {
  io.emit("gameScene", getScene());
}

function broadcastLegacyPosition() {
  io.emit("stonePosition", {
    x: stoneX,
    y: stoneY,
    angle: stoneAngle,
    state: stoneState
  });
}

function broadcastReady() {
  io.emit("readyState", {
    A: readyA,
    B: readyB,
    bothReady
  });
}

function broadcastEverything() {
  broadcastScene();
  broadcastLegacyPosition();
  broadcastReady();
}

// =====================================
// 10. CLEAR NEXT-STONE TIMER
// =====================================

function clearNextTimer() {
  if (nextStoneTimer !== null) {
    clearTimeout(nextStoneTimer);
    nextStoneTimer = null;
  }
}

// =====================================
// 11. RESET CONFIRMATIONS
// =====================================

function resetConfirmations() {
  readyA = false;
  readyB = false;
  bothReady = false;
}

// =====================================
// 12. SPAWN A STONE
// =====================================

function spawnStone() {
  clearNextTimer();

  if (currentIndex >= STONES.length) {
    stoneState = "completed";
    resetConfirmations();

    console.log("All seven stones completed!");

    broadcastEverything();
    return;
  }

  stoneX = SPAWN_X;
  stoneY = SPAWN_Y;
  stoneAngle = 0;

  stoneBody = null;
  stoneState = "held";

  stableFrames = 0;
  wrongSupportFrames = 0;

  resetConfirmations();

  console.log(
    "Now placing:",
    currentIndex + 1,
    STONES[currentIndex].name
  );

  broadcastEverything();
}

// =====================================
// 13. RELEASE CURRENT STONE
// =====================================

function releaseStone() {
  if (stoneState !== "held") {
    return;
  }

  const data = STONES[currentIndex];

  stoneBody = Bodies.rectangle(
    stoneX,
    stoneY,
    data.width,
    data.height,
    {
      label: data.name,
      restitution: 0.03,
      friction: 0.85,
      frictionStatic: 1,
      density: 0.001
    }
  );

  World.add(engine.world, stoneBody);

  stoneState = "falling";

  stableFrames = 0;
  wrongSupportFrames = 0;

  console.log("Released:", data.name);

  broadcastEverything();
}

// =====================================
// 14. CHECK CONTACT WITH SUPPORT
// =====================================

function touchesSupport(body, support) {
  return Query.collides(
    body,
    [support]
  ).length > 0;
}

// =====================================
// 15. CHECK CORRECT STACKING
// =====================================

function isSupported(index, body) {
  let support;
  let supportWidth;

  if (index === 0) {
    // Hope must rest on platform
    support = platform;
    supportWidth = 360;

  } else {
    // Every later stone must rest on
    // the stone immediately before it
    const previous = placedStones.find(
      (item) => item.index === index - 1
    );

    if (!previous) {
      return false;
    }

    support = previous.body;
    supportWidth = STONES[index - 1].width;
  }

  // The stone must touch its support
  if (!touchesSupport(body, support)) {
    return false;
  }

  // Its centre must be above the support
  if (body.position.y >= support.position.y) {
    return false;
  }

  // Prevent stones resting too far to
  // one side from counting as stacked
  const bodyWidth = STONES[index].width;

  const horizontalOffset = Math.abs(
    body.position.x - support.position.x
  );

  const allowedOffset =
    (bodyWidth + supportWidth) * 0.35;

  if (horizontalOffset > allowedOffset) {
    return false;
  }

  return true;
}

// =====================================
// 16. CHECK PREVIOUSLY PLACED STONES
// =====================================

function findEarliestUnstableStone() {
  for (let i = 0; i < placedStones.length; i++) {
    const item = placedStones[i];

    const body = item.body;

    // Movement since the stone settled
    const moved = Math.hypot(
      body.position.x - item.savedX,
      body.position.y - item.savedY
    );

    // Rotation since the stone settled
    const rotated = Math.abs(
      body.angle - item.savedAngle
    );

    // Overall tilt
    const tilted = Math.abs(body.angle);

    // Did the stone move too far?
    const drifted =
      moved > MAX_POSITION_DRIFT ||
      rotated > MAX_ANGLE_DRIFT;

    // Did the stone fall outside the world?
    const fallen =
      body.position.y > 500 ||
      body.position.x < -100 ||
      body.position.x > 740;

    // Is the support still correct?
    const unsupported =
      !isSupported(item.index, body);

    const unstable =
      drifted ||
      fallen ||
      unsupported ||
      tilted > MAX_TOTAL_TILT;

    // Count continuous unstable frames.
    // A short physical wobble will not
    // immediately trigger a rollback.
    if (unstable) {
      item.unstableFrames++;
    } else {
      item.unstableFrames = 0;
    }

    if (item.unstableFrames >= UNSTABLE_FRAMES) {
      return item.index;
    }
  }

  return -1;
}

// =====================================
// 17. ROLLBACK TO THE EARLIEST
//     AFFECTED STONE
// =====================================

function rollbackTo(index) {
  clearNextTimer();

  const targetIndex = Math.max(
    0,
    Math.min(index, STONES.length - 1)
  );

  console.log(
    "COLLAPSE - Restart from:",
    STONES[targetIndex].name
  );

  // Remove the stone currently falling
  if (stoneBody) {
    World.remove(
      engine.world,
      stoneBody
    );

    stoneBody = null;
  }

  const remaining = [];

  // Keep earlier stable stones.
  // Remove the affected stone and
  // all stones placed after it.
  for (const item of placedStones) {
    if (item.index < targetIndex) {
      item.unstableFrames = 0;
      remaining.push(item);

    } else {
      World.remove(
        engine.world,
        item.body
      );
    }
  }

  placedStones = remaining;

  currentIndex = targetIndex;

  stableFrames = 0;
  wrongSupportFrames = 0;

  spawnStone();
}

// =====================================
// 18. SAVE A SUCCESSFULLY SETTLED STONE
// =====================================

function settleStone() {
  if (
    stoneState !== "falling" ||
    !stoneBody
  ) {
    return;
  }

  const body = stoneBody;

  placedStones.push({
    index: currentIndex,

    body,

    savedX: body.position.x,
    savedY: body.position.y,
    savedAngle: body.angle,

    unstableFrames: 0
  });

  console.log(
    "Stone settled:",
    STONES[currentIndex].name
  );

  stoneBody = null;
  stoneState = "settled";

  stableFrames = 0;
  wrongSupportFrames = 0;

  broadcastEverything();

  clearNextTimer();

  nextStoneTimer = setTimeout(() => {
    nextStoneTimer = null;

    if (stoneState !== "settled") {
      return;
    }

    // Check the entire stack again
    const unstableIndex =
      findEarliestUnstableStone();

    if (unstableIndex >= 0) {
      rollbackTo(unstableIndex);
      return;
    }

    currentIndex++;

    if (currentIndex >= STONES.length) {
      stoneState = "completed";

      console.log(
        "All seven stones stacked successfully!"
      );

      broadcastEverything();

    } else {
      spawnStone();
    }

  }, NEXT_STONE_DELAY);
}

// =====================================
// 19. RESTART THE ENTIRE GAME
// =====================================

function resetGame() {
  clearNextTimer();

  if (stoneBody) {
    World.remove(
      engine.world,
      stoneBody
    );

    stoneBody = null;
  }

  for (const item of placedStones) {
    World.remove(
      engine.world,
      item.body
    );
  }

  placedStones = [];

  currentIndex = 0;

  stableFrames = 0;
  wrongSupportFrames = 0;

  spawnStone();

  console.log("Game restarted");
}

io.on("connection", (socket) => {
  let role = null;

  socket.on("selectPlace", (place) => {
    if (socket.id !== playerA && socket.id !== playerB) return;

    if (
      !Object.prototype.hasOwnProperty.call(platformHeights, place)
    ) return;

    if (place === selectedPlace) return;

    selectedPlace = place;

    Matter.Body.setPosition(platform, {
      x: 320,
      y: platformHeights[place]
    });

    resetGame();
  });
  if (playerA === null) {
    playerA = socket.id;
    role = "A";

  } else if (playerB === null) {
    playerB = socket.id;
    role = "B";
  }

  socket.emit("role", role);

  socket.emit("gameScene", getScene());

  socket.emit("stonePosition", {
    x: stoneX,
    y: stoneY,
    angle: stoneAngle,
    state: stoneState
  });

  socket.emit("readyState", {
    A: readyA,
    B: readyB,
    bothReady
  });

  console.log(
    "Player connected:",
    role,
    socket.id
  );

  // ---------------------------------
  // PLAYER A: HAND CONTROLS Y
  // ---------------------------------

  socket.on("setHandY", (targetY) => {
    if (role !== "A") return;
    if (readyA) return;
    if (stoneState !== "held") return;
    if (!Number.isFinite(targetY)) return;

    stoneY = Math.max(
      40,
      Math.min(320, targetY)
    );

    broadcastEverything();
  });

  // ---------------------------------
  // PLAYER B: HAND CONTROLS X
  // ---------------------------------

  socket.on("setHandX", (targetX) => {
    if (role !== "B") return;
    if (readyB) return;
    if (stoneState !== "held") return;
    if (!Number.isFinite(targetX)) return;

    stoneX = Math.max(
      75,
      Math.min(565, targetX)
    );

    broadcastEverything();
  });

  // ---------------------------------
  // KEYBOARD TEST: PLAYER A
  // ---------------------------------

  socket.on("moveY", (amount) => {
    if (role !== "A") return;
    if (readyA) return;
    if (stoneState !== "held") return;
    if (!Number.isFinite(amount)) return;

    const step = Math.max(
      -5,
      Math.min(5, amount)
    );

    stoneY = Math.max(
      40,
      Math.min(320, stoneY + step)
    );

    broadcastEverything();
  });

  // ---------------------------------
  // KEYBOARD TEST: PLAYER B
  // ---------------------------------

  socket.on("moveX", (amount) => {
    if (role !== "B") return;
    if (readyB) return;
    if (stoneState !== "held") return;
    if (!Number.isFinite(amount)) return;

    const step = Math.max(
      -5,
      Math.min(5, amount)
    );

    stoneX = Math.max(
      75,
      Math.min(565, stoneX + step)
    );

    broadcastEverything();
  });

  // ---------------------------------
  // TWO-PLAYER PRAYER CONFIRMATION
  // ---------------------------------

  socket.on("playerReady", () => {
    if (stoneState !== "held") {
      return;
    }

    if (role === "A") {
      readyA = true;

    } else if (role === "B") {
      readyB = true;

    } else {
      return;
    }

    console.log(
      "Player ready:",
      role
    );

    if (readyA && readyB && !bothReady) {
      bothReady = true;

      broadcastEverything();

      releaseStone();

    } else {
      broadcastEverything();
    }
  });

  // ---------------------------------
  // R: RESET OR RETRY
  // ---------------------------------

  socket.on("resetReady", () => {
    if (
      role !== "A" &&
      role !== "B"
    ) {
      return;
    }

    if (stoneState === "completed") {
      resetGame();

    } else if (stoneState === "falling") {
      rollbackTo(currentIndex);

    } else if (stoneState === "settled") {
      rollbackTo(currentIndex);

    } else if (stoneState === "held") {
      resetConfirmations();
      broadcastEverything();
    }
  });

  // ---------------------------------
  // DISCONNECT
  // ---------------------------------

  socket.on("disconnect", () => {
    let playerLeft = false;

    if (playerA === socket.id) {
      playerA = null;
      playerLeft = true;
    }

    if (playerB === socket.id) {
      playerB = null;
      playerLeft = true;
    }

    if (playerLeft) {
      // Development behaviour:
      // restart when an active player leaves
      resetGame();
    }

    console.log(
      "Player disconnected:",
      socket.id
    );
  });
});

// =====================================
// 21. MATTER.JS PHYSICS LOOP
// =====================================

setInterval(() => {
  // Keep simulating previously placed
  // stones even while the next stone
  // is being controlled.
  Engine.update(engine, 1000 / 60);

  // ---------------------------------
  // CHECK PREVIOUSLY PLACED STONES
  // ---------------------------------

  const unstableIndex =
    findEarliestUnstableStone();

  if (unstableIndex >= 0) {
    rollbackTo(unstableIndex);
    return;
  }

  // ---------------------------------
  // ONLY PROCESS THE CURRENT STONE
  // WHEN IT IS FALLING
  // ---------------------------------

  if (
    stoneState !== "falling" ||
    !stoneBody
  ) {
    return;
  }

  stoneX = stoneBody.position.x;
  stoneY = stoneBody.position.y;
  stoneAngle = stoneBody.angle;

  // ---------------------------------
  // DETECT STONE FALLING OFF
  // ---------------------------------

  const outOfBounds =
    stoneY > 530 ||
    stoneX < -120 ||
    stoneX > 760;

  const tooTilted =
    Math.abs(stoneAngle) > 1.0;

  if (outOfBounds || tooTilted) {
    console.log(
      "Current stone failed:",
      STONES[currentIndex].name
    );

    rollbackTo(currentIndex);
    return;
  }

  // ---------------------------------
  // CHECK SPEED
  // ---------------------------------

  const nearlyStill =
    stoneBody.speed < 0.15 &&
    stoneBody.angularSpeed < 0.03;

  // ---------------------------------
  // CHECK SUPPORT
  // ---------------------------------

  const supported =
    isSupported(
      currentIndex,
      stoneBody
    );

  const upright =
    Math.abs(stoneAngle) < MAX_TOTAL_TILT;

  // ---------------------------------
  // COUNT SUCCESSFUL STABLE FRAMES
  // ---------------------------------

  if (
    nearlyStill &&
    supported &&
    upright
  ) {
    stableFrames++;

  } else {
    stableFrames = 0;
  }

  // ---------------------------------
  // CONFIRM SUCCESSFUL STACKING
  // ---------------------------------

  if (stableFrames >= STABLE_FRAMES) {
    settleStone();
    return;
  }

  // ---------------------------------
  // COUNT FRAMES ON WRONG SUPPORT
  // ---------------------------------

  if (
    nearlyStill &&
    stoneY > 300 &&
    (!supported || !upright)
  ) {
    wrongSupportFrames++;

    if (
      wrongSupportFrames >=
      WRONG_SUPPORT_FRAMES
    ) {
      console.log(
        "Wrong support - retry:",
        STONES[currentIndex].name
      );

      rollbackTo(currentIndex);
      return;
    }

  } else {
    wrongSupportFrames = 0;
  }

}, 1000 / 60);

// =====================================
// 22. NETWORK UPDATE LOOP
// =====================================

setInterval(() => {
  // Update both players approximately
  // 30 times per second.
  broadcastScene();

  if (stoneState === "falling") {
    broadcastLegacyPosition();
  }

}, 1000 / 30);

// =====================================
// 23. START SERVER
// =====================================

server.listen(3000, () => {
  console.log(
    "Server running at http://localhost:3000"
  );
});
