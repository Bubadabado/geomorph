let img;
let img_data = []; 
let slopes = [];

const pixel_scale = 1.; //TODO implement properly with new layer system or remove

const ELEV_RANGE = {
    max: 691.94488525391,
    min: 117.5,
    get range() { return this.max - this.min; }
}

let bounds;
let checkBounds;

let mouse;

let ocean = {
    threshold: 0.,
    color: {
        r: 0,
        g: 70,
        b: 255,
        a: 128
    }
}

let overlay;

function preload() {
    img = loadImage("map.png");
}

function setup() {
    // define bounds and bounds checker
    bounds = {
        w: img.width * pixel_scale,
        h: img.height * pixel_scale,
    }
    checkBounds = {
        x: (x) => 0 <= x && x < bounds.w,
        y: (y) => 0 <= y && y < bounds.h,
        p(x, y) { return this.x(x) && this.y(y); },
    }

    // initialize canvas layers
    createCanvas(bounds.w, bounds.h);
    bg = createGraphics(bounds.w, bounds.h);
    bg.image(img, 0, 0);
    img.loadPixels();
    overlay = createGraphics(bounds.w, bounds.h);
    overlay.clear();
    overlay.loadPixels();

    // perform per-pixel setup operations
    iterateMap(updatePuddle);
    overlay.updatePixels();

    // begin DOM update loop
    updateDOM();
}

function draw() {
    background(0);
    image(bg, 0, 0);
    image(overlay, 0, 0);
}

function iterateMap(fn) {
    for (let r = 0; r < img.height; r++) {
        for (let c = 0; c < img.width; c++) {
            fn(r, c);
        }
    }
}

function dilate(n) {
    
}

function getValue(r, c) {
    return img.pixels[(r * img.width + c) * 4];
}

// update the ocean
function updateOcean() {
    overlay.clear();
    overlay.loadPixels();
    iterateMap(updatePuddle);
    overlay.updatePixels();
}
// update a single pixel in the ocean grid
function updatePuddle(r, c) {
    if (ocean.threshold > getValue(r, c)) {
        writeToOverlay(r, c, ocean.color);
    }
}

function writeToOverlay(r, c, col) {
    const i = 4 * (r * img.width + c);
    overlay.pixels[i + 0] = col.r;
    overlay.pixels[i + 1] = col.g;
    overlay.pixels[i + 2] = col.b;
    overlay.pixels[i + 3] = col.a;
}

// elevation
function mapRangeToElev(val) {
    return ELEV_RANGE.min + (val / 255.) * (ELEV_RANGE.range);
}
function getElevAt(x, y) {
    return checkBounds.p(x, y) ? mapRangeToElev(getValue(y, x)) : "OOB";
}


// DOM FUNCTIONS
// Handle regular DOM updates
let coords;
let elevation;
let sea_level;
let sea_level_value;
document.addEventListener("DOMContentLoaded", () => {
    coords = document.getElementById("coords");
    elevation = document.getElementById("elevation");
    sea_level = document.getElementById("sea-level");
    sea_level_value = document.getElementById("sea-level-value");

    sea_level.min = -1;
    sea_level.max = 256;
    sea_level.value = -1;
    sea_level.addEventListener("input", updateSeaLevel);
});

// perform per-frame updates
function updateDOM() {
    mouse = {
        x: round(mouseX),
        y: round(mouseY),
    };

    // perform updates
    updateCoords();
    updateElevation();
    requestAnimationFrame(updateDOM);
}

// update helper functions
function updateCoords() {
    coords.textContent = `X: ${mouse.x}\nY: ${mouse.y}`;
}
function updateElevation() {
    elevation.textContent = `E: ${getElevAt(mouse.x, mouse.y)}`;
}
function updateSeaLevel() {
    ocean.threshold = sea_level.value;
    updateOcean();
    sea_level_value.textContent = `${
        sea_level.value == sea_level.min
            ? 0
            : mapRangeToElev(sea_level.value)
    }`;
}
