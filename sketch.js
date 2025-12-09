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
let local_maxima = [];
let local_minima = [];
let labels_maxima = [];
let labels_minima = [];
let groups = [];
let current_label = 1;

let temp = []; //TODO remove

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
let show_group_overlay = true;
let slope_overlay;
let group_overlay;
let ocean_overlay;

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
        labels_maxima = [...Array(bounds.h)].map(() => Array(bounds.w).fill(0));
        labels_minima = [...Array(bounds.h)].map(() => Array(bounds.w).fill(0));
        temp = [...Array(bounds.h)].map(() => Array(bounds.w).fill(0));
        groups = [...Array(bounds.h)].map(() => Array(bounds.w).fill(0));
        let colored = [...Array(bounds.h)].map(() => Array(bounds.w).fill(0));

        // initialize canvas layers
        createCanvas(bounds.w, bounds.h);
        bg = createGraphics(bounds.w, bounds.h);
        bg.pixelDensity(1);
        bg.image(map, 0, 0);
        map.loadPixels();
        slope_overlay = createGraphics(bounds.w, bounds.h);
        slope_overlay.pixelDensity(1);
        slope_overlay.clear();
        slope_overlay.loadPixels();
        group_overlay = createGraphics(bounds.w, bounds.h);
        group_overlay.pixelDensity(1);
        group_overlay.clear();
        group_overlay.loadPixels();
        ocean_overlay = createGraphics(bounds.w, bounds.h);
        ocean_overlay.pixelDensity(1);
        ocean_overlay.clear();
        ocean_overlay.loadPixels();

        // perform per-pixel setup operations
        iterateMap((r, c) => {
            updatePuddle(r, c);
            setSlope(r, c);
            setLocalMaxima(r, c);
            setLocalMinima(r, c);
        });
        labelCntdCmpts(local_maxima, labels_maxima);
        labelCntdCmpts(local_minima, labels_minima);
        groupFeatures(labels_minima);
        labelCntdCmpts(labels_minima, temp, 0);

        //color local minima features
        iterateMap((r, c) => {
             if(temp[r][c] !== 0) {
                const col = {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 128
                };
                colored[r][c] = 1;

                writeToOverlay(r, c, col, group_overlay);
            }
        });

        groupFeatures(labels_maxima, 2);
        groupFeatures(local_minima, 2);
        
        //color local maxima features
        iterateMap((r, c) => {
             if(temp[r][c] !== 0 && colored[r][c] == 0) {
                randomSeed(temp[r][c] * 65539);
                const col = {
                    r: random(0, 255),
                    g: random(0, 255),
                    b: random(0, 255),
                    a: 80
                };
                writeToOverlay(r, c, col, group_overlay);
            }
        });

        //update graphics buffers
        slope_overlay.updatePixels();
        ocean_overlay.updatePixels();
        group_overlay.updatePixels();

        // begin DOM update loop
        updateDOM();
    }

    //draw each frame
    function draw() {
        background(0);
        noSmooth();
        image(bg, 0, 0);
        if (show_slope_overlay) 
            image(slope_overlay, 0, 0);
        if (show_group_overlay)
            image(group_overlay, 0, 0);
        image(ocean_overlay, 0, 0);
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
    ocean_overlay.clear();
    ocean_overlay.loadPixels();
    iterateMap(updatePuddle);
    ocean_overlay.updatePixels();
}
// update a single pixel in the ocean grid
function updatePuddle(r, c) {
    if (ocean.threshold > getValue(r, c)) {
        writeToOverlay(r, c, ocean.color, ocean_overlay);
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

function setLocalMaxima(r, c) {
    if (local_maxima[r] === undefined)
        local_maxima[r] = [];
    local_maxima[r][c] = findExtrema(r, c, 5);
}

function setLocalMinima(r, c) {
    if (local_minima[r] === undefined)
        local_minima[r] = [];
    local_minima[r][c] = findExtrema(r, c, 5, false);
}

// find local extrema at r,c with kernel of shape n,n
function findExtrema(r, c, n = 3, max = true) {
    const rad = Math.floor(n / 2);
    let extrema = getValue(r, c);
    const traverse = max ? Math.max : Math.min

    for (let y = -rad; y <= rad; y++) 
        for (let x = -rad; x <= rad; x++) 
            if ((x !== 0 || y !== 0) && check_bounds.p(c + x, r + y)) 
                extrema = traverse(extrema, getValue(r + y, c + x));

    is_local_extrema = extrema == getValue(r, c);
    return is_local_extrema ? extrema : false;
}
// Combine connected components into labels via stack floodfill
// from and to are arrays of the same shape as the map
// from should either contain false or some value
function labelCntdCmpts(from, to, def = false) {
    // to ??= [...Array(bounds.h)].map(() => Array(bounds.w).fill(0));
    iterateMap((r, c) => {
        if (from[r][c] !== def && to[r][c] == 0) {
            let stack = [];
            stack.push({
                r: r,
                c: c
            });
            while (stack.length > 0) {
                p = stack.pop();
                if (to[p.r][p.c] == 0) {
                    to[p.r][p.c] = current_label;
                    for (let rr = -1; rr <= 1; rr++) {
                        for (let cc = -1; cc <= 1; cc++) {
                            const r2 = p.r + rr;
                            const c2 = p.c + cc;
                            if ((rr === 0 && cc === 0) || !check_bounds.p(c2, r2) || from[r2][c2] === def)
                                continue;
                            stack.push({ r: r2, c: c2 });
                        }
                    }
                }
            }
            current_label++;
        }
    });
}

//TODO fix and document this mess
function groupFeatures(arr, n = 1) {
    // margin of error; 0.0 means that the floodfill will only go downhill, whereas 
    // any value above that will allow for travelling up to that value in m upwards.
    // Low values may lead to some 'holes' in groups where terrain is noisy 
    const MOE = 0.0; 
    const DELTA_SLOPE = 5;
    let DELTA_ELEV = 4; //dark is smooth at 4m TODO (range)
    
    
    const fn = () => {
        const queue = [];
        let qi = 0; 
        iterateMap((r, c) => {
            if (arr[r][c] !== 0) {
                queue.push({r, c}); 
            }
        });

        while (qi < queue.length) {
            //reference point
            const p = queue[qi++];
            const group_label = arr[p.r][p.c];
            
            for (let rr = -1; rr <= 1; rr++) {
                for (let cc = -1; cc <= 1; cc++) {
                    //target coords
                    const r2 = p.r + rr;
                    const c2 = p.c + cc;

                    if (false 
                        || (rr === 0 && cc === 0) 
                        || !check_bounds.p(c2, r2) 
                        || arr[r2][c2] !== 0
                        || abs(getElevAt(c2, r2) - getElevAt(p.c, p.r)) > DELTA_ELEV
                        // || slopes[p.r][p.c] - slopes[r2][c2] > DELTA_SLOPE
                    ) { continue; }
                    
                    queue.push({ r: r2, c: c2 });
                    arr[r2][c2] = group_label;
                }
            }
        }
    }
    
    

    const fn2 = () => {
        const queue = [];
        let qi = 0; 
        iterateMap((r, c) => {
            if (arr[r][c] !== 0 && temp[r][c] === 0) { //don't overwrite minima on plateaus
                queue.push({r, c}); 
            }
        });

        while (qi < queue.length) {
            //reference point
            const p = queue[qi++];
            const group_label = arr[p.r][p.c];
            temp[p.r][p.c] = group_label;
            for (let rr = -1; rr <= 1; rr++) {
                for (let cc = -1; cc <= 1; cc++) {
                    //target coords
                    const r2 = p.r + rr;
                    const c2 = p.c + cc;

                    if (false
                        || (rr === 0 && cc === 0) 
                        || !check_bounds.p(c2, r2) 
                        || arr[r2][c2] !== 0
                        || temp[r2][c2] !== 0
                        || getElevAt(c2, r2) > getElevAt(p.c, p.r)
                        // || slopes[p.r][p.c] - slopes[r2][c2] > DELTA_SLOPE
                    ) { continue; }
                    
                    queue.push({ r: r2, c: c2 });
                    arr[r2][c2] = group_label;
                    temp[r2][c2] = group_label;
                }
            }
        }
    }

    if (n == 1) {
        fn();
    } else {
        fn2();
    }
}

//write color col to buffer overlay at row r, col c
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

// DOM update helper functions
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
