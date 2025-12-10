const map_data = [
    {
        name: "Guilin Yangshuo",
        img_src: "map.png",
        citation: "TODO CITATION",
        map_data_metadata: {
            xscale_deg: 0.0002777777777777777775,
            yscale_deg: 0.0002777777777777777775,
            emin_m: 117.5,
            emax_m: 691.94488525391,
            extent: {
                xmin: 110.3387499888889067,
                ymin: 24.8320833444444418,
                xmax: 110.5731944333333558,
                ymax: 25.1384722333333315,
            }
        },
        rs_data_metadata: "dem"
    },
    {
        name: "Ha Long Bay",
        img_src: "hlbmap.png",
        citation: "TODO CITATION",
        map_data_metadata: {
            xscale_deg: 0.0002777777777777777775,
            yscale_deg: 0.0002777777777777777775,
            emin_m: 0,
            emax_m: 255,
            extent: {
                xmin: 106.9401388777777981,
                ymin: 20.6940277888888851,
                xmax: 107.2387499888889124,
                ymax: 20.9076388999999949,
            }
        },
        rs_data_metadata: "dem"
    },
]

const data_sets = {
    dem: {
        name: "TODO",
        spatial: "30m Spatial Resolution"
    }
}