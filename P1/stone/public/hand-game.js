
let socket;
let playerRole = null;

let video;
let handPose;
let hands = [];

const stoneNames = [
  "Hope", "Courage", "Love", "Trust",
  "Peace", "Together", "Joy"
];

const stoneSizes = [
  [150, 48], [135, 43], [120, 40],
  [108, 38], [98, 35], [85, 32], [70, 30]
];

const stoneColors = [
  [181, 198, 174],
  [182, 181, 199],
  [216, 184, 169],
  [175, 198, 197],
  [201, 217, 196],
  [206, 185, 169],
  [216, 185, 190]
];

// Server-authoritative game state
let scene = null;

let fingerX = 320;
let fingerY = 240;
let lastDetectedTime = -10000;
let lastSendTime = 0;

let connectionStatus = "Connecting...";
let modelStatus = "Opening camera...";
let gestureStatus = "Show one hand to move";
let lastSent = "None";

let prayerReady = false;

// Prayer gesture tracking
let gestureArmed = false;
let gestureStartTime = -1;
let closeStartTime = -1;
let lastCloseTime = -10000;
let previousDistance = null;
let closestDistance = Infinity;
let approachCount = 0;

const START_DISTANCE = 220;
const CLOSE_DISTANCE = 145;
const NEAR_DISTANCE = 175;
const HOLD_TIME = 500;
const OVERLAP_WINDOW = 450;
const GESTURE_TIMEOUT = 4000;


// 1. SETUP
function setup() {
  createCanvas(640, 480);

  socket = io();

  socket.on("connect", () => {
    connectionStatus = "Connected";
  });

  socket.on("role", (role) => {
    playerRole = role;
    console.log("Player:", role);
  });

  // Receive the entire shared scene
  socket.on("gameScene", (newScene) => {
    const previousIndex = scene
      ? scene.currentIndex
      : -1;

    scene = newScene;

    // Reset gesture for a newly spawned stone
    if (scene.currentIndex !== previousIndex) {
      prayerReady = false;
      resetGesture();
    }

    prayerReady =
      (playerRole === "A" && scene.readyA) ||
      (playerRole === "B" && scene.readyB);
  });

  socket.on("disconnect", () => {
    connectionStatus = "Disconnected";
    playerRole = null;
    prayerReady = false;
    scene = null;
    resetGesture();
  });

  // Start camera, then HandPose
  video = createCapture(VIDEO, async () => {
    try {
      modelStatus = "Loading HandPose...";

      handPose = await ml5.handPose({
        maxHands: 2
      });

      handPose.detectStart(video, gotHands);
      modelStatus = "HandPose ready!";
    } catch (error) {
      modelStatus = "HandPose error";
      console.error(error);
    }
  });

  video.size(640, 480);
  video.hide();
}


// 2. HANDPOSE RESULTS
function gotHands(results) {
  hands = results;

  if (!scene || scene.stoneState !== "held") {
    return;
  }

  if (prayerReady) return;

  if (hands.length === 1) {
    const finger = hands[0].index_finger_tip;

    if (finger) {
      fingerX = lerp(fingerX, finger.x, 0.4);
      fingerY = lerp(fingerY, finger.y, 0.4);
      lastDetectedTime = millis();
    }
  }

  detectPrayer();
}


// 3. PALM CENTRE
function getPalmCenter(hand) {
  const p = hand.keypoints;

  if (!p || p.length < 21) return null;

  return {
    x: (p[0].x + p[5].x + p[17].x) / 3,
    y: (p[0].y + p[5].y + p[17].y) / 3
  };
}

function isUprightOpenHand(hand) {
  const p = hand.keypoints;

  if (!p || p.length < 21) return false;

  const tips = [8, 12, 16, 20];
  const bases = [5, 9, 13, 17];

  let count = 0;

  for (let i = 0; i < tips.length; i++) {
    if (
      p[tips[i]].y < p[bases[i]].y - 10 &&
      p[tips[i]].y < p[0].y - 20
    ) {
      count++;
    }
  }

  return count >= 3;
}

function resetGesture() {
  gestureArmed = false;
  gestureStartTime = -1;
  closeStartTime = -1;
  lastCloseTime = -10000;
  previousDistance = null;
  closestDistance = Infinity;
  approachCount = 0;
  gestureStatus = "Show one hand to move";
}

function detectPrayer() {
  if (!socket || !socket.connected) return;
  if (!scene || scene.stoneState !== "held") return;
  if (prayerReady) return;

  const now = millis();

  if (hands.length === 1) {
    const validOverlap =
      gestureArmed &&
      approachCount >= 2 &&
      closestDistance < NEAR_DISTANCE &&
      now - lastCloseTime < OVERLAP_WINDOW;

    if (validOverlap) {
      confirmPrayer();
      return;
    }

    if (
      gestureStartTime >= 0 &&
      now - gestureStartTime > GESTURE_TIMEOUT
    ) {
      resetGesture();
    }

    if (!gestureArmed) {
      gestureStatus = "One hand: moving";
    }

    return;
  }

  if (hands.length === 0) {
    gestureStatus = "No hands detected";

    if (
      gestureStartTime >= 0 &&
      now - gestureStartTime > GESTURE_TIMEOUT
    ) {
      resetGesture();
    }
    return;
  }

  if (hands.length === 2) {
    const a = getPalmCenter(hands[0]);
    const b = getPalmCenter(hands[1]);

    if (!a || !b) return;

    const distance = dist(
      a.x, a.y,
      b.x, b.y
    );

    const upright =
      isUprightOpenHand(hands[0]) &&
      isUprightOpenHand(hands[1]);

    if (!upright) {
      resetGesture();
      gestureStatus = "Keep fingers pointing up";
      return;
    }

    if (!gestureArmed) {
      if (distance > START_DISTANCE) {
        gestureArmed = true;
        gestureStartTime = now;
        previousDistance = distance;
        closestDistance = distance;
        gestureStatus = "Bring palms together";
      } else {
        gestureStatus = "Separate hands first";
      }
      return;
    }

    if (now - gestureStartTime > GESTURE_TIMEOUT) {
      resetGesture();
      return;
    }

    if (
      previousDistance !== null &&
      previousDistance - distance > 3
    ) {
      approachCount++;
    }

    previousDistance = distance;
    closestDistance = min(
      closestDistance, distance
    );

    if (
      distance < NEAR_DISTANCE &&
      approachCount >= 2
    ) {
      lastCloseTime = now;
    }

    if (
      distance < CLOSE_DISTANCE &&
      approachCount >= 2
    ) {
      if (closeStartTime < 0) {
        closeStartTime = now;
      }

      gestureStatus = "Hold palms together";

      if (now - closeStartTime >= HOLD_TIME) {
        confirmPrayer();
      }
    } else {
      closeStartTime = -1;
      gestureStatus = "Hands approaching";
    }
  }
}


// 7. SEND PRAYER CONFIRMATION
function confirmPrayer() {
  if (prayerReady) return;
  if (!socket || !socket.connected) return;

  if (playerRole !== "A" && playerRole !== "B") {
    return;
  }

  prayerReady = true;
  gestureStatus = "Prayer confirmed";

  socket.emit("playerReady");
}


// 8. SEND HAND POSITION
function sendHandPosition() {
  if (!socket || !socket.connected) return;
  if (!scene || scene.stoneState !== "held") return;
  if (prayerReady) return;

  if (hands.length !== 1) return;
  if (millis() - lastDetectedTime > 300) return;
  if (millis() - lastSendTime < 60) return;

  const targetX = constrain(
    map(fingerX, 0, 640, 75, 565),
    75, 565
  );

  const targetY = constrain(
    map(fingerY, 0, 480, 40, 320),
    40, 320
  );

  if (playerRole === "A") {
    socket.emit("setHandY", targetY);
    lastSent = "Sent Y: " + round(targetY);
    lastSendTime = millis();
  }

  if (playerRole === "B") {
    socket.emit("setHandX", targetX);
    lastSent = "Sent X: " + round(targetX);
    lastSendTime = millis();
  }
}


// 9. DRAW A STONE
function drawOneStone(index, x, y, angle) {
  const size = stoneSizes[index];
  const color = stoneColors[index];

  if (!size || !color) return;

  push();
  translate(x, y);
  rotate(angle);

  stroke(75, 96, 80);
  strokeWeight(2);
  fill(color[0], color[1], color[2]);

  ellipse(0, 0, size[0], size[1]);

  noStroke();
  fill(48, 70, 56);
  textAlign(CENTER, CENTER);
  textSize(index === 5 ? 12 : 14);

  text(stoneNames[index], 0, 0);

  pop();
}


// 10. DRAW PLATFORM
function drawPlatform() {
  noStroke();
  fill(115, 141, 120);

  rectMode(CENTER);
  rect(320, 420, 360, 24, 5);
  rectMode(CORNER);
}


// 11. DRAW ALL STONES
function drawStones() {
  if (!scene) return;

  // Previously placed stones
  for (const stone of scene.stones) {
    drawOneStone(
      stone.index,
      stone.x,
      stone.y,
      stone.angle
    );
  }

  // Current stone
  if (
    scene.stoneState !== "completed" &&
    scene.stoneState !== "settled"
  ) {
    drawOneStone(
      scene.currentIndex,
      scene.stoneX,
      scene.stoneY,
      scene.stoneAngle
    );
  }
}


// 12. CAMERA PREVIEW
function drawCameraPreview() {
  if (!video || video.elt.readyState < 2) return;

  const x = 460;
  const y = 340;
  const w = 160;
  const h = 120;

  image(video, x, y, w, h);

  if (
    hands.length === 1 &&
    millis() - lastDetectedTime < 300
  ) {
    noStroke();
    fill(255, 220, 40);

    circle(
      x + fingerX / 640 * w,
      y + fingerY / 480 * h,
      12
    );
  }
}


// 13. DISPLAY INFORMATION
function drawInformation() {
  noStroke();
  fill(40);
  textAlign(LEFT, TOP);
  textSize(14);

  text("Connection: " + connectionStatus, 15, 15);
  text("Player: " + (playerRole || "Waiting"), 15, 40);

  if (!scene) {
    text("Waiting for game data...", 15, 75);
    return;
  }

  text(
    "Stone: " +
    (scene.currentIndex + 1) +
    "/7 " +
    stoneNames[Math.min(scene.currentIndex, 6)],
    15, 65
  );

  text(
    "X: " + round(scene.stoneX) +
    "  Y: " + round(scene.stoneY),
    15, 90
  );

  text("Hands: " + hands.length, 15, 120);
  text("Gesture: " + gestureStatus, 15, 145);
  text(modelStatus, 15, 175);

  text(lastSent, 15, 200);

  text(
    "Player A: " +
    (scene.readyA ? "READY" : "Not ready"),
    15, 300
  );

  text(
    "Player B: " +
    (scene.readyB ? "READY" : "Not ready"),
    15, 325
  );

  text("R = Reset / Retry", 15, 455);

  if (scene.stoneState === "completed") {
    drawMessage("I HOPE YOU ARE OKAY");
  } else if (scene.stoneState === "falling") {
    drawMessage("RELEASING WISH...");
  } else if (scene.stoneState === "settled") {
    drawMessage("STONE SETTLED");
  } else if (scene.bothReady) {
    drawMessage("BOTH PLAYERS READY");
  } else if (prayerReady) {
    drawMessage("WAITING FOR PARTNER");
  }
}


// 14. DRAW STATUS MESSAGE
function drawMessage(message) {
  noStroke();
  fill(73, 125, 88);

  rect(95, 255, 450, 55, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(20);

  text(message, 320, 282);
}


// 15. DRAW
function draw() {
  background(225, 235, 225);

  sendHandPosition();
  drawPlatform();
  drawStones();
  drawCameraPreview();
  drawInformation();
}


// 16. RESET / RETRY
function keyPressed() {
  if (key === "r" || key === "R") {
    resetGesture();

    if (socket && socket.connected) {
      socket.emit("resetReady");
    }

    return false;
  }
}
