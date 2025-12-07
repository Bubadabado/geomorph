const M_PER_DEG = 111320;

let map;
let map_metadata = {
    xscale_deg: 0.0002777777777777777775,
    yscale_deg: 0.0002777777777777777775,
    emin_m: 117.5,
    emax_m: 691.94488525391,
    extent: {
        xmin: 110.3387499888889067,
        ymin: 24.8320833444444418,
        xmax: 110.5731944333333558,
        ymax: 25.1384722333333315,
    },

    //latitude of pixel center
    lat(r) {
        return (
            this.extent.ymax - (r + 0.5) * (this.extent.ymax - this.extent.ymin) / map.height
        ) * Math.PI / 180;
    },

    //discrete slope approximation using central difference method
    dx_m(r) { return this.xscale_deg * M_PER_DEG * Math.cos(this.lat(r)); },
    dy_m( ) { return this.yscale_deg * M_PER_DEG; },
    dzdx(r, c) { return (getElevAt(c + 1, r) - getElevAt(c - 1, r)) / (2 * this.dx_m(r)); },
    dzdy(r, c) { return (getElevAt(c, r + 1) - getElevAt(c, r - 1)) / (2 * this.dy_m( )); },
    slope(r, c) { 
        return (
            Math.atan(Math.sqrt(this.dzdx(r,c) * this.dzdx(r,c) + this.dzdy(r,c) * this.dzdy(r,c)))
        ) * 180 / Math.PI;
    }
}; 
let slopes = [];
let dilated = [];

const pixel_scale = 1.; //TODO implement properly with new layer system or remove

const ELEV_RANGE = {
    max: map_metadata.emax_m,
    min: map_metadata.emin_m,
    get range() { return this.max - this.min; }
};

let bounds;
let check_bounds;

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

let show_slope_overlay = false;
let show_group_overlay = false;
let slope_overlay;
let group_overlay;
let overlay;

// =========================
//   p5js-called functions
// =========================
{
    //preload map
    function preload() {
        map = loadImage("map.png");
    }

    //perform setup
    function setup() {
        // define bounds and bounds checker
        bounds = {
            w: map.width * pixel_scale,
            h: map.height * pixel_scale,
        }
        check_bounds = {
            x: (x) => 0 <= x && x < bounds.w,
            y: (y) => 0 <= y && y < bounds.h,
            p(x, y) { return this.x(x) && this.y(y); },
        }

        // initialize canvas layers
        createCanvas(bounds.w, bounds.h);
        bg = createGraphics(bounds.w, bounds.h);
        bg.image(map, 0, 0);
        map.loadPixels();
        slope_overlay = createGraphics(bounds.w, bounds.h);
        slope_overlay.clear();
        slope_overlay.loadPixels();
        group_overlay = createGraphics(bounds.w, bounds.h);
        group_overlay.clear();
        group_overlay.loadPixels();
        overlay = createGraphics(bounds.w, bounds.h);
        overlay.clear();
        overlay.loadPixels();

        // perform per-pixel setup operations
        iterateMap((r, c) => {
            updatePuddle(r, c);
            setSlope(r, c);
            dilate(r, c, 5);
        });
        slope_overlay.updatePixels();
        overlay.updatePixels();
        group_overlay.updatePixels();

        // begin DOM update loop
        updateDOM();
    }

    //draw each frame
    function draw() {
        background(0);
        image(bg, 0, 0);
        if (show_slope_overlay) 
            image(slope_overlay, 0, 0);
        if (show_group_overlay)
            image(group_overlay, 0, 0);
        image(overlay, 0, 0);
    }
}

// =========================
//   helper functions
// =========================

function iterateMap(fn) {
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            fn(r, c);
        }
    }
}

function getValue(r, c) {
    return map.pixels[(r * map.width + c) * 4];
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
        writeToOverlay(r, c, ocean.color, overlay);
    }
}

// calculate and set slope value at a given position
function setSlope(r, c) {
    if (slopes[r] === undefined)
        slopes[r] = [];
    slopes[r][c] = map_metadata.slope(r, c);

    // map the color from a range of 0-90 to 0-255 (slope > 90 would be an overhang)
    col = slopes[r][c] / 90. * 255
    writeToOverlay(r, c, {
        r: col,
        g: col,
        b: col,
        a: 255
    }, slope_overlay);
}

function dilate(r, c, n = 3) {
    if (dilated[r] === undefined)
        dilated[r] = [];
    
    const rad = Math.floor(n / 2);
    let max = -Infinity;
    for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
            if (check_bounds.p(c + x, r + y)) 
                max = Math.max(max, getValue(r + y, c + x));
        }
    }
    is_local_maxima = max == getValue(r, c);
    dilated[r][c] = col = is_local_maxima ? max : 0;

    writeToOverlay(r, c, {
        r: col,
        g: 0,
        b: 0,
        a: is_local_maxima ? 255 : 0
    }, group_overlay);
}

function writeToOverlay(r, c, col, overlay) {
    const i = 4 * (r * map.width + c);
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
    return check_bounds.p(x, y) ? mapRangeToElev(getValue(y, x)) : "OOB";
}
function getSlopeAt(x, y) {
    return check_bounds.p(x, y) ? slopes[y][x] : "OOB";
}


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

document.addEventListener("DOMContentLoaded", () => {
    coords = document.getElementById("coords");
    elevation = document.getElementById("elevation");

    slope = document.getElementById("slope");
    slope_overlay_box = document.getElementById("slope-overlay-box")
    slope_overlay_box.checked = show_slope_overlay;
    slope_overlay_box.addEventListener("input", (event) => show_slope_overlay = event.target.checked);

    group_overlay_box = document.getElementById("group-overlay-box")
    group_overlay_box.checked = show_group_overlay;
    group_overlay_box.addEventListener("input", (event) => show_group_overlay = event.target.checked);

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

// update helper functions
function updateCoords() {
    coords.textContent = `X: ${mouse.x}\nY: ${mouse.y}`;
}
function updateElevation() {
    elevation.textContent = `Elevation (m): ${getElevAt(mouse.x, mouse.y)}`;
}
function updateSlope() {
    slope.textContent = `Slope: ${getSlopeAt(mouse.x, mouse.y)}`;
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
