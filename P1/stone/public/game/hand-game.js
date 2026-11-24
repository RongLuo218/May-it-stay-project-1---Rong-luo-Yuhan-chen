let successScheduled = false;
let stoneImages = [];
function preload() {
  handPose = ml5.handPose({ maxHands: 2 });

  for (let i = 0; i < 7; i++) {
    stoneImages[i] = loadImage(
      "../assets/stone" + (i + 1) + ".PNG"
    );
  }
}
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
const canvas = createCanvas(main.clientWidth, main.clientHeight);
canvas.parent(main);
canvas.position(0, 0);
canvas.style("z-index", "6");
canvas.style("pointer-events", "none");
  socket = io();
  ["lake", "snow", "land", "sea"].forEach((place) => {
  document.getElementById(place + "-button")
    .addEventListener("click", () => {
      if (socket.connected) {
        socket.emit("selectPlace", place);
      }
    });
});
  socket.on("connect", () => {
    connectionStatus = "Connected";
  });

  socket.on("role", (role) => {
    playerRole = role;
    console.log("Player:", role);
  });
 
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

  if (scene.stoneState === "completed" && !successScheduled) {
  successScheduled = true;

  setTimeout(() => {
    const successScreen = document.getElementById("success-screen");

    if (successScreen) {
      successScreen.hidden = false;
    }
  }, 2000);
}
  });


  socket.on("disconnect", () => {
    connectionStatus = "Disconnected";
    playerRole = null;
    prayerReady = false;
    scene = null;
    resetGesture();
  });

video = createCapture(VIDEO, () => {
  handPose.detectStart(video, gotHands);
  modelStatus = "HandPose ready!";
});
  video.size(640, 480);
  video.hide();
}
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


// 5. RESET GESTURE DETECTOR
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

function sendHandPosition() {
  if (!socket || !socket.connected) return;
  if (!scene || scene.stoneState !== "held") return;
  if (prayerReady) return;

  if (hands.length !== 1) return;
  if (millis() - lastDetectedTime > 1000) return;
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


function drawOneStone(index, x, y, angle) {
  const picture = stoneImages[index];
  const size = stoneSizes[index];

  if (!picture || !size) return;

  push();
  translate(x, y);
  rotate(angle);
  imageMode(CENTER);
  const stoneWidth = size[0] * 1;
const stoneHeight = stoneWidth * picture.height / picture.width;
image(picture, 0, 0, stoneWidth, stoneHeight);
  pop();
}
function drawPlatform() {
}

function drawStones() {
  if (!scene) return;

  for (const stone of scene.stones) {
    drawOneStone(
      stone.index,
      stone.x,
      stone.y,
      stone.angle
    );
  }

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

function drawCameraPreview() {
  if (!video || video.elt.readyState < 2) return;

  const x = 495;
  const y = 240;
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

function drawInformation() {
  push();
  noStroke();
  fill(55, 65, 55);
  textAlign(LEFT, TOP);
  textSize(8);
  text("Connection: " + connectionStatus, 23, 53);
    if (scene) {
    text(
      "Place: " + scene.selectedPlace +
      " / Platform Y: " + scene.platformY,
      23, 145
    );
  text("Player: " + (playerRole || "Waiting"), 23, 66);}

  text("Hands: " + hands.length, 23, 118);

  if (scene) {
    text(
      "A: " + (scene.readyA ? "Ready" : "Not ready") +
      " / B: " + (scene.readyB ? "Ready" : "Not ready"),
      23, 92
    );
    let message = gestureStatus;
    if (scene.stoneState === "completed") {
      message = "May our wish stay.";
    } else if (prayerReady) {
      message = "Waiting for your partner";
    }
    text(message, 23, 105, 174, 26);
  }

  text("R = Reset / Retry", 23, 133);

  pop();
}
function drawMessage(message) {
  noStroke();
  fill(73, 125, 88);

  rect(95, 255, 450, 55, 12);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(20);

  text(message, 320, 282);
}
function draw() {
  clear();

  if (
    width !== main.clientWidth ||
    height !== main.clientHeight
  ) {
    resizeCanvas(main.clientWidth, main.clientHeight);
  }

  if (!gameStarted || stoneGuide.open) return;

  sendHandPosition();
  const gameScale = Math.min(width / 640, height / 480);

  push();
  translate(
    (width - 640 * gameScale) / 2,
    (height - 480 * gameScale) / 2
  );
  scale(gameScale);

  drawPlatform();
  drawStones();
  drawCameraPreview();
drawInformation();
  pop();
}

function keyPressed() {
  if (key === "r" || key === "R") {
    resetGesture();

    if (socket && socket.connected) {
      socket.emit("resetReady");
    }

    return false;
  }
}
