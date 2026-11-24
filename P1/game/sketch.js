const titleButton = document.getElementById("title-button");
const main = document.querySelector("main");
titleButton.addEventListener("click", function () {
  main.classList.add("entered");
  titleButton.hidden = true;
  document.getElementById("game-intro").hidden = false;
  document.getElementById("lake-button").hidden = false;
  document.getElementById("snow-button").hidden = false;
  document.getElementById("land-button").hidden = false;
  document.getElementById("sea-button").hidden = false;
  document.getElementById("start-button").hidden = true;
});
document.getElementById("lake-button").addEventListener("click", function() {
    const lakeScene = document.getElementById("lake-scene");
  lakeScene.hidden = false;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
    main.classList.add("show-lake");
    });
  });
  document.getElementById("lake-button").hidden = true;
  document.getElementById("snow-button").hidden = true;
  document.getElementById("land-button").hidden = true;
  document.getElementById("sea-button").hidden = true;
  document.getElementById("game-intro").hidden = true;
  document.getElementById("back-button").hidden = false;
  document.getElementById("book-button").hidden = false;
  document.getElementById("start-button").hidden = false;
});
document.getElementById("snow-button").addEventListener("click", function() {
    const snowScene = document.getElementById("snow-scene");
  snowScene.hidden = false;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      main.classList.add("show-snow");
    });
  });

  document.getElementById("lake-button").hidden = true;
  document.getElementById("snow-button").hidden = true;
  document.getElementById("land-button").hidden = true;
  document.getElementById("sea-button").hidden = true;
  document.getElementById("game-intro").hidden = true;
  document.getElementById("back-button").hidden = false;
  document.getElementById("book-button").hidden = false;
  document.getElementById("start-button").hidden = false;
});
document.getElementById("back-button").addEventListener("click", function() {
    main.classList.remove("show-lake","show-snow","show-land","show-sea");
    document.getElementById("lake-button").hidden = false;
    document.getElementById("snow-button").hidden = false;
    document.getElementById("land-button").hidden = false;
    document.getElementById("sea-button").hidden = false;
    document.getElementById("book-button").hidden = true;
    document.getElementById("start-button").hidden = true;
    document.getElementById("game-intro").hidden = true;
    this.hidden = true;
});
document.getElementById("land-button").addEventListener("click", function() {
    const landScene = document.getElementById("land-scene");
  landScene.hidden = false;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
    main.classList.add("show-land");
    });
});
  document.getElementById("lake-button").hidden = true;
  document.getElementById("snow-button").hidden = true;
  document.getElementById("land-button").hidden = true;
  document.getElementById("sea-button").hidden = true;
  document.getElementById("game-intro").hidden = true;
  document.getElementById("back-button").hidden = false;
  document.getElementById("book-button").hidden = false;
  document.getElementById("start-button").hidden = false;
});
document.getElementById("sea-button").addEventListener("click", function() {
    const seaScene = document.getElementById("sea-scene");
  seaScene.hidden = false;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
    main.classList.add("show-sea");
    });
});
  document.getElementById("lake-button").hidden = true;
  document.getElementById("snow-button").hidden = true;
  document.getElementById("land-button").hidden = true;
  document.getElementById("sea-button").hidden = true;
  document.getElementById("game-intro").hidden = true;
  document.getElementById("back-button").hidden = false;
  document.getElementById("book-button").hidden = false;
  document.getElementById("start-button").hidden = false;
});
const stoneGuide = document.getElementById("stone-guide");
document.getElementById("book-button").addEventListener("click", function () {
  stoneGuide.showModal();
});
document.getElementById("close-guide").addEventListener("click", function () {
  stoneGuide.close();
});
const stoneDescriptions = [
    "Wish - A small wish begins here",
    "Trust — We find balance together",
    "Care — A little care can travel far",
    "Hope — Good things can still grow",
    "Patience — Take your time, stone by stone",
    "Together — Your hands meet mine here",
    "Stay — May this moment stay with us"
];
let stoneIndex = 0;
function updateStone() {
    document.getElementById("current-stone").src =
    "../assets/stone"+(stoneIndex + 1) + ".png";
    document.getElementById("stone-description").textContent =
    stoneDescriptions[stoneIndex];
    document.getElementById("stone-counter").textContent=
    (stoneIndex + 1) +"/7";
}
document.getElementById("previous-stone").addEventListener("click", function () {
  stoneIndex = (stoneIndex + 6) % 7;
  updateStone();
});
document.getElementById("next-stone").addEventListener("click", function () {
  stoneIndex = (stoneIndex + 1) % 7;
  updateStone();
});
updateStone();
let stoneX = 0;
let stoneY = 0;
let stoneImage;
let gameStarted = false;
function preload() {
  stoneImage = loadImage("../assets/stone1.PNG");
}
function setup() {
  const canvas = createCanvas(main.clientWidth, main.clientHeight);
  canvas.parent(main);
  canvas.position(0, 0);
  canvas.style("z-index", "6");
  canvas.style("pointer-events", "none");
}
document.getElementById("start-button").addEventListener("click", function () {
  resizeCanvas(main.clientWidth, main.clientHeight);
  stoneX = width / 2 - 180;
  stoneY = height / 2 - 160;
  gameStarted = true;
  this.hidden = true;
});
document.getElementById("back-button").addEventListener("click", function () {
  gameStarted = false;
});
function draw() {
  clear();
  if (!gameStarted || stoneGuide.open) {
    return;
  }
  if (keyIsDown(65)) stoneX -= 2;
  if (keyIsDown(68)) stoneX += 2;
  if (keyIsDown(UP_ARROW)) stoneY -= 2;
  if (keyIsDown(DOWN_ARROW)) stoneY += 2;
  stoneX = constrain(stoneX, 0, width - 360);
  stoneY = constrain(stoneY, 0, height - 200);
  image(stoneImage, stoneX, stoneY, 360, 200);
}
function keyPressed() {
  if (gameStarted && !stoneGuide.open &&
      (keyCode === UP_ARROW || keyCode === DOWN_ARROW)) {
    return false;
  }
}