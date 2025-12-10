// Map data
let selected_map_data = {};
let map;

let ocean = {
    threshold: 0.,
    color: {
        r: 0,
        g: 70,
        b: 255,
        a: 128
    }
}

// Global label counter
let current_label = 1;

// Overlay management
let oh;

const BG = "bg";
const SLOPE = "slope";
const GROUP = "group";
const OCEAN = "ocean";
const SELECT = "select";

let group_data = {
    labels: [],
    no_select: [],
    selected: [],
    selected_metadata: []
}
let mouse_prev = {
    x: 0,
    y: 0
};
const SELECTION_TYPES = {
    individual: "individual",
    box_select: "box",
}
const ADD_OR_REMOVE = {
    add: "add",
    remove: "remove",
}
const SELECTION_COL = makeCol(() => 255, 160);

// =========================
//   p5js-called functions
// =========================

// preload map
function preload() {
    for (item of map_data) {
        if (item.img_src == selected_img) {
            item.img = loadImage(item.img_src);
            selected_map_data = item;
        }
    }
}

// perform setup
function setup() {
    //initialize the map
    map = new RegionMap(selected_map_data.img, selected_map_data.map_data_metadata);

    // init data arrays
    let [
        local_maxima, 
        local_minima, 
        labels_maxima, 
        labels_minima,
    ] = Array(5).fill(0).map(() => initArray());

    // initialize canvas layers
    const cnv = createCanvas(map.bounds.w, map.bounds.h);
    cnv.parent('canvas-container');
    map.img.loadPixels();
    oh = new OverlayHandler(map.bounds.w, map.bounds.h);
    oh.add(BG, true);
    oh.add(SLOPE, show_slope_overlay);
    oh.add(GROUP, show_group_overlay);
    oh.add(OCEAN, true);
    oh.add(SELECT, true);

    // perform per-pixel setup operations
    iterateMap((r, c) => {
        local_maxima[r][c] = findExtrema(r, c, 5);
        local_minima[r][c] = findExtrema(r, c, 5, false);
    });
    // label connected maxima and minima separately
    labelCntdCmpts(local_minima, labels_minima);
    // flat floodfill minima to create groups
    groupFeatures(labels_minima, labels_minima);
    // combine minima groups (declutters non-areas of interest)
    let combined_minima = [...Array(map.bounds.h)].map(() => Array(map.bounds.w).fill(0));
    current_label = 1; //reset counter
    labelCntdCmpts(labels_minima, combined_minima, 0);
    labelCntdCmpts(local_maxima, labels_maxima);

    // floodfill maxima to create groups
    let groups = combined_minima.map(row => [...row]);
    group_data.no_select = combined_minima;
    groupFeatures(labels_maxima, groups, false);
    // floodfill minima once again (high->low) to handle plateaus
    groupFeatures(local_minima, groups, false);

    // populate accessible group data
    group_data.labels = groups;
    group_data.selected = initArray();
    group_data.selected_metadata = Array.from(
        { length: current_label }, 
        (_, label) => ({
            selected: false,
            label,
            pixels: [], //store r, c, slope, elev
            area() { 
                return this.pixels.reduce((tot, p) => {
                    return tot + (map.dx_m(p.r) * map.dy_m());
                }, 0);
            },
            maxSlope() {
                return this.pixels.reduce((ex, p) => max(ex, p.slope), -Infinity);
            },
            peak() {
                return map.mapRangeToElev(
                    this.pixels.reduce((ex, p) => max(ex, p.elev), -Infinity)
                );
            },
            trough() {
                return map.mapRangeToElev(
                    this.pixels.reduce((ex, p) => min(ex, p.elev), Infinity)
                );
            },
            height() { return this.peak() - this.trough(); },
        }
    ));
    iterateMap((r, c) => {
        if (groups[r][c] !== false) {
            group_data.selected_metadata[groups[r][c]].pixels.push({
                r, c,
                elev: map.getValue(r, c),
                slope: map.slope(r, c),
            });
        }
    });

    // Draw colors to the buffer given pre-computed data arrays
    oh.drawImageToLayer(BG, map.img);
    oh.setGraphics((r, c) => {
        // color slope buffer; map slope value (0-90) to color value (0-255)
        oh.writeToLayer(r, c, SLOPE, makeCol(() => map.slope(r, c) / 90. * 255, 255));

        // color ocean buffer
        updatePuddle(r, c);

        // color group buffer
        if (combined_minima[r][c] !== 0) {
            oh.writeToLayer(r, c, GROUP, makeCol(() => 0, 128));
        } else if(groups[r][c] !== 0) {
            randomSeed(groups[r][c] * 65539);
            oh.writeToLayer(r, c, GROUP, makeCol(() => random(0, 255), 80));
        }
    }, [SLOPE, OCEAN, GROUP]);

    // begin DOM update loop
    updateDOM();
}

// Draw each frame
function draw() {
    oh.draw();

    noFill();
    strokeWeight(2);
    stroke(255, 255, 255, 200);
    if (mouseIsPressed && selection_type == SELECTION_TYPES.box_select) {
        rect(mouse_prev.x, mouse_prev.y, mouse.x - mouse_prev.x, mouse.y - mouse_prev.y);
    }
}

// Handle mouse input
function mousePressed() {
    switch (selection_type) {
        case SELECTION_TYPES.individual:
            if (map.check_bounds.p(mouse.x, mouse.y)) {
                const r = mouse.y;
                const c = mouse.x;
                updateSelection(r, c);
            }
            break;
        case SELECTION_TYPES.box_select:
            mouse_prev = mouse;
            break;
        default:
    }
}
function mouseReleased() {
    if (selection_type == SELECTION_TYPES.box_select && map.check_bounds.p(mouse.x, mouse.y)) {
        updateSelectionBox(mouse_prev.y, mouse_prev.x, mouse.y, mouse.x);
    }
}

// =========================
//   helper functions
// =========================

// init array with map size
function initArray() {
    return [...Array(map.bounds.h)].map(() => Array(map.bounds.w).fill(0));
}

// iterate through the map, calling fn on each pixel
function iterateMap(fn) {
    for (let r = 0; r < map.bounds.h; r++)
        for (let c = 0; c < map.bounds.w; c++)
            fn(r, c);
}

// =========================
//   Graphics helpers
// =========================

// make a color where r, g, and b share a method of calculation
function makeCol(c, a) {
    return { r: c(), g: c(), b: c(), a }
}

// update a single pixel in the ocean overlay buffer
function updatePuddle(r, c) {
    if (ocean.threshold > map.getValue(r, c))
        oh.writeToLayer(r, c, OCEAN, ocean.color);
}

// Handle selections
function updateSelection(r, c) {
    label = group_data.labels[r][c];
    if (label !== false && group_data.no_select[r][c] == 0) {
        let stack = [];
        stack.push({
            r: r,
            c: c
        });

        group_data.selected[r][c] = add_or_remove; // TOGGLE !group_data.selected[r][c];
        group_data.selected_metadata[label].selected = add_or_remove; // TOGGLE group_data.selected[r][c];
        while (stack.length > 0) {
            p = stack.pop();
            for (let rr = -1; rr <= 1; rr++) {
                for (let cc = -1; cc <= 1; cc++) {
                    const r2 = p.r + rr;
                    const c2 = p.c + cc;
                    if (false 
                        || (rr === 0 && cc === 0) 
                        || !map.check_bounds.p(c2, r2) 
                        || group_data.labels[r2][c2] !== label
                        || group_data.selected[r2][c2] == group_data.selected[r][c]
                    ) continue;

                    stack.push({ r: r2, c: c2 });

                    group_data.selected[r2][c2] = add_or_remove; // TOGGLE !group_data.selected[r2][c2];
                    group_data.selected_metadata[label].selected = add_or_remove; // TOGGLE group_data.selected[r][c];
                }
            }
        }
    }
    oh.setGraphics((r, c) => {
        if (group_data.selected[r][c]) 
            oh.writeToLayer(r, c, SELECT, SELECTION_COL);
    }, [SELECT]);
} 
function updateSelectionBox(rr1, cc1, rr2, cc2) {
    visited = initArray();
    for (let r = min(rr1, rr2); r < max(rr1, rr2); r++) {
        for (let c = min(cc1, cc2); c < max(cc1, cc2); c++) {
            if (!visited[r][c] && group_data.no_select[r][c] == 0) {
                visited[r][c] = true;
                label = group_data.labels[r][c];
                if (label !== false) {
                    let stack = [];
                    stack.push({
                        r: r,
                        c: c
                    });

                    group_data.selected[r][c] = add_or_remove;
                    group_data.selected_metadata[label].selected = add_or_remove;
                    while (stack.length > 0) {
                        p = stack.pop();
                        for (let rr = -1; rr <= 1; rr++) {
                            for (let cc = -1; cc <= 1; cc++) {
                                const r2 = p.r + rr;
                                const c2 = p.c + cc;
                                if (false 
                                    || (rr === 0 && cc === 0) 
                                    || !map.check_bounds.p(c2, r2) 
                                    || visited[r2][c2]
                                    || group_data.labels[r2][c2] !== label
                                    || group_data.selected[r2][c2] == group_data.selected[r][c]
                                ) continue;

                                stack.push({ r: r2, c: c2 });

                                group_data.selected[r2][c2] = add_or_remove;
                                group_data.selected_metadata[label].selected = add_or_remove;
                                visited[r2][c2] = true;
                            }
                        }
                    }
                }
            }
        }
    }
    oh.setGraphics((r, c) => {
        if (group_data.selected[r][c]) 
            oh.writeToLayer(r, c, SELECT, SELECTION_COL);
    }, [SELECT]);
}

// =========================
//   data manipulation
// =========================

// find local extrema at r,c with kernel of shape n,n
function findExtrema(r, c, n = 3, max = true) {
    const rad = Math.floor(n / 2);
    let extrema = map.getValue(r, c);
    const traverse = max ? Math.max : Math.min

    for (let y = -rad; y <= rad; y++) 
        for (let x = -rad; x <= rad; x++) 
            if ((x !== 0 || y !== 0) && map.check_bounds.p(c + x, r + y)) 
                extrema = traverse(extrema, map.getValue(r + y, c + x));

    is_local_extrema = extrema == map.getValue(r, c);
    return is_local_extrema ? extrema : false;
}

// Combine connected components into labels via stack floodfill
// from and to are arrays of the same shape as the map
// from should either contain false or some value
// TODO cleanup to avoid having to pass def
function labelCntdCmpts(from, to, def = false) {
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
                            if ((rr === 0 && cc === 0) || !map.check_bounds.p(c2, r2) || from[r2][c2] === def)
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

// Run a floodfill to group features
// If plat is true, it will fill regions that are flat within an 
// elevation change of DELTA_ELEV (used with local minima for plateaus)
// Otherwise, it will only expand the floodfill down in elevation 
// (used with local maxima for elevated features)
function groupFeatures(from, to, plat = true) {
    const DELTA_ELEV = 4; //4m change in elevation
    const base = (rr, cc, r2, c2, p) => {
        return false 
            || (rr === 0 && cc === 0) 
            || !map.check_bounds.p(c2, r2) 
            || from[r2][c2] !== 0 
            || to[r2][c2] !== 0
            || (plat
                ? abs(map.getElevAt(c2, r2) - map.getElevAt(p.c, p.r)) > DELTA_ELEV
                : map.getElevAt(c2, r2) > map.getElevAt(p.c, p.r)
            )
    }
    const queue = [];
    let qi = 0; 
    iterateMap((r, c) => {
        // TODO cleanup - pass to into next part of pipeline 
        // instead of having same from and to
        if (from[r][c] !== 0 && (plat || to[r][c] === 0)) { 
            queue.push({r, c}); 
        }
    });

    while (qi < queue.length) {
        //reference point
        const p = queue[qi++];
        const group_label = from[p.r][p.c];
        to[p.r][p.c] = group_label;
        
        for (let rr = -1; rr <= 1; rr++) {
            for (let cc = -1; cc <= 1; cc++) {
                //target coords
                const r2 = p.r + rr;
                const c2 = p.c + cc;

                if (base(rr, cc, r2, c2, p)) continue;
                
                queue.push({ r: r2, c: c2 });
                from[r2][c2] = group_label;
                to[r2][c2] = group_label;
            }
        }
    }
}