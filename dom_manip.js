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

let selected_img;

let selection_type_options;
let add_or_remove_options;
let add_or_remove;
let selection_type;
let selection_table;
let pull_selection_data;

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

    selected_img = (new URLSearchParams(window.location.search)).get("img_src");

    selection_type_options = document.querySelectorAll('input[name="selection"]');
    selection_type = document.querySelector('input[name="selection"]:checked').value;
    selection_type_options.forEach(opt => {
        opt.addEventListener('change', () => {
            selection_type = document.querySelector('input[name="selection"]:checked').value;
        });
    });

    add_or_remove_options = document.querySelectorAll('input[name="add-or-remove"]');
    add_or_remove = +(document.querySelector('input[name="add-or-remove"]:checked').value == ADD_OR_REMOVE.add);
    add_or_remove_options.forEach(opt => {
        opt.addEventListener('change', () => {
            add_or_remove = +(document.querySelector('input[name="add-or-remove"]:checked').value == ADD_OR_REMOVE.add);
        });
    });
    
    pull_selection_data = document.getElementById("pull-selection-data");
    pull_selection_data.addEventListener("click", (event) => {
        event.preventDefault;
        updateSelectionTable();
    });

    selection_table = document.getElementById('data-table');
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

function updateSelectionTable() {
    // Create table element
    const table = document.createElement('table');
    table.classList.add("data-table");

    const headers = ["Label", "Area (m^2)", "Max Slope", "Peak (m)", "Trough (m)", "Height (m)"];
    const thead = table.createTHead();
    const headerRow = thead.insertRow();

    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });
    
    const tbody = table.createTBody();

    group_data.selected_metadata
        .filter(o => o.selected)
        .forEach(o => {
            const row = tbody.insertRow();

            [
                o.label,
                o.area(),
                o.maxSlope(),
                o.peak(),
                o.trough(),
                o.height(),
            ].forEach(item => {
                const cell = row.insertCell();
                cell.textContent = item;
            })
        });
    
    selection_table.innerHTML = "";
    selection_table.appendChild(table);
}
