class OverlayHandler {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.layers = new Map();
    }

    add(key, visible = false) {
        this.layers.set(key, {
            visible,
            graphics: (() => {
                const g = createGraphics(this.w, this.h);
                g.pixelDensity(1);
                g.clear();
                return g;
            })()
        });
    }

    setGraphics(setup, keys = [...this.layers.keys()]) {
        keys.forEach(key => {
            const g = this.layers.get(key).graphics;
            g.clear();
            g.loadPixels()
        });
        iterateMap(setup);
        keys.forEach(key => this.layers.get(key).graphics.updatePixels());
    }

    writeToLayer(r, c, key, col) {
        const i = 4 * (r * this.w + c);
        this.layers.get(key).graphics.pixels[i + 0] = col.r;
        this.layers.get(key).graphics.pixels[i + 1] = col.g;
        this.layers.get(key).graphics.pixels[i + 2] = col.b;
        this.layers.get(key).graphics.pixels[i + 3] = col.a;
    }

    drawImageToLayer(key, img) {
        this.layers.get(key).graphics.image(img, 0, 0);
    }

    getVisible(key) {
        return this.layers.get(key).visible;
    }
    setVisible(key, visible) {
        this.layers.get(key).visible = visible;
    }

    draw() {
        this.layers.values().filter(l => l.visible).forEach(l => { 
            image(l.graphics, 0, 0); 
        });
    }
}