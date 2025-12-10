class RegionMap {
    static M_PER_DEG = 111320;

    constructor(img, metadata) {
        this.img = img;
        this.bounds = {
            w: img.width,
            h: img.height,
        }
        this.check_bounds = {
            x: (x) => 0 <= x && x < this.bounds.w,
            y: (y) => 0 <= y && y < this.bounds.h,
            p(x, y) { return this.x(x) && this.y(y); },
        }
        //save metadata
        this.xscale_deg = metadata.xscale_deg;
        this.yscale_deg = metadata.yscale_deg;
        this.emin_m = metadata.emin_m;
        this.emax_m = metadata.emax_m;
        this.extent = metadata.extent;
        //Object.assign(this, metadata);

        this.elev_range = {
            max: this.emax_m,
            min: this.emin_m,
            get range() { return this.max - this.min; }
        }
    }

    // get elevation value at row r, col c
    getValue(r, c) {
        return this.img.pixels[(r * this.bounds.w + c) * 4];
    }

    // latitude of pixel center (rad)
    lat(r) {
        return (
            this.extent.ymax - (r + 0.5) * (this.extent.ymax - this.extent.ymin) / this.img.height
        ) * Math.PI / 180;
    }

    // discrete slope approximation using central difference method
    slope(r, c) { 
        const dx_m = (r) => this.xscale_deg * RegionMap.M_PER_DEG * Math.cos(this.lat(r));
        const dy_m = ( ) => this.yscale_deg * RegionMap.M_PER_DEG;
        const dzdx = (r, c) => (this.getElevAt(c + 1, r) - this.getElevAt(c - 1, r)) / (2 * dx_m(r));
        const dzdy = (r, c) => (this.getElevAt(c, r + 1) - this.getElevAt(c, r - 1)) / (2 * dy_m( ));

        return (
            Math.atan(Math.sqrt(dzdx(r,c) * dzdx(r,c) + dzdy(r,c) * dzdy(r,c)))
        ) * 180 / Math.PI;
    }

    //map range 0-255 to elevation range
    mapRangeToElev(val) {
        return this.elev_range.min + (val / 255.) * (this.elev_range.range);
    }

    //safe getters checked by bounds
    getElevAt(x, y) {
        return this.check_bounds.p(x, y) ? this.mapRangeToElev(this.getValue(y, x)) : "OOB";
    }
    getSlopeAt(x, y) {
        return this.check_bounds.p(x, y) ? this.slope(y, x) : "OOB";
    }
}