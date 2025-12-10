// =========================
//   DOM interaction
// =========================
let coords;
let elevation;
let slope;
let slope_overlay_box;
let group_overlay_box;
let sea_level;
let sea_level_value;

let mouse;

let show_slope_overlay = false;
let show_group_overlay = false;

document.addEventListener("DOMContentLoaded", () => {
    coords = document.getElementById("coords");
    elevation = document.getElementById("elevation");

    slope = document.getElementById("slope");
    slope_overlay_box = document.getElementById("slope-overlay-box")
    slope_overlay_box.checked = show_slope_overlay;
    slope_overlay_box.addEventListener("input", (event) => oh.setVisible(SLOPE, event.target.checked));

    group_overlay_box = document.getElementById("group-overlay-box")
    group_overlay_box.checked = show_group_overlay;
    group_overlay_box.addEventListener("input", (event) => oh.setVisible(GROUP, event.target.checked));

    sea_level = document.getElementById("sea-level");
    sea_level_value = document.getElementById("sea-level-value");
    sea_level.min = -1;
    sea_level.max = 256;
    sea_level.value = -1;
    sea_level.addEventListener("input", updateSeaLevel);
});

// Handle regular DOM updates
function updateDOM() {
    // convert mouse coords into array indexes
    mouse = {
        x: round(mouseX),
        y: round(mouseY),
    };

    // perform updates
    updateCoords();
    updateElevation();
    updateSlope();

    //continue the loop
    requestAnimationFrame(updateDOM);
}

// DOM update helper functions
function updateCoords() {
    coords.textContent = `X: ${mouse.x}\nY: ${mouse.y}`;
}
function updateElevation() {
    elevation.textContent = `Elevation (m): ${map.getElevAt(mouse.x, mouse.y)}`;
}
function updateSlope() {
    slope.textContent = `Slope: ${map.getSlopeAt(mouse.x, mouse.y)}`;
}
function updateSeaLevel() {
    ocean.threshold = sea_level.value;
    oh.setGraphics(updatePuddle, [OCEAN]);
    sea_level_value.textContent = `${
        sea_level.value == sea_level.min
            ? 0
            : map.mapRangeToElev(sea_level.value)
    }`;
}
