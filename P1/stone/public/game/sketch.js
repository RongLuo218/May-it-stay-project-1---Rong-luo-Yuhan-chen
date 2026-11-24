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
    document.getElementById("game-intro").hidden = false;
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
    "../assets/stone"+(stoneIndex + 1) + ".PNG";
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
let gameStarted = false;
document.getElementById("start-button").addEventListener("click", function () {
  gameStarted = true;
  this.hidden = true;
});
document.getElementById("back-button").addEventListener("click", function () {
  gameStarted = false;
});
document.getElementById("play-again").addEventListener("click", function () {
  window.location.reload();
});
document.getElementById("success-home").addEventListener("click", function () {
  window.location.href = "/game/";
});