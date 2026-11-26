// Multi-camera RGB-only tracking metrics, transcribed from Table 1.
export const BENCHMARKS = {
  "kubric": {
    "label": "MV-Kubric",
    "context": "30 clips · 24 frames",
    "rows": [
      [
        "OmniX",
        "66.14",
        "14.03",
        "47.47",
        "0.3264",
        null,
        null
      ],
      [
        "4RC (multi-view)",
        "79.27",
        "41.78",
        "71.10",
        "0.2094",
        null,
        null
      ],
      [
        "VGGT-Ω + TrackEverything",
        "80.33",
        "45.71",
        "74.19",
        "0.2291",
        "39.57",
        "55.96"
      ],
      [
        "DA3 + TrackEverything",
        "81.41",
        "48.94",
        "74.59",
        "0.2210",
        "40.62",
        "56.12"
      ],
      [
        "VGGT-Ω + MVTracker",
        "71.84",
        "30.32",
        "55.52",
        "0.2568",
        "51.07",
        "70.36"
      ],
      [
        "DA3 + MVTracker",
        "80.15",
        "44.96",
        "73.26",
        "0.2127",
        "57.66",
        "72.89"
      ],
      [
        "VGGT-Ω + CoTracker3",
        "83.29",
        "58.63",
        "78.40",
        "0.2570",
        null,
        null
      ],
      [
        "DA3 + CoTracker3",
        "82.74",
        "56.95",
        "77.33",
        "0.2307",
        null,
        null
      ],
      [
        "MVMC",
        "89.24",
        "67.21",
        "87.66",
        "0.1118",
        "62.79",
        "73.22"
      ]
    ]
  },
  "panoptic": {
    "label": "Panoptic",
    "context": "6 clips · 150 frames",
    "rows": [
      [
        "OmniX",
        "54.53",
        "2.10",
        "16.76",
        "0.4133",
        null,
        null
      ],
      [
        "4RC (multi-view)",
        "70.45",
        "18.81",
        "53.78",
        "0.2529",
        null,
        null
      ],
      [
        "VGGT-Ω + TrackEverything",
        "67.63",
        "18.75",
        "51.37",
        "0.2898",
        "44.60",
        "69.01"
      ],
      [
        "DA3 + TrackEverything",
        "61.42",
        "13.12",
        "42.05",
        "0.3617",
        "46.44",
        "75.61"
      ],
      [
        "VGGT-Ω + MVTracker",
        "72.37",
        "18.77",
        "54.03",
        "0.2319",
        "60.01",
        "84.05"
      ],
      [
        "DA3 + MVTracker",
        "59.37",
        "12.83",
        "38.68",
        "0.3766",
        "48.81",
        "82.04"
      ],
      [
        "VGGT-Ω + CoTracker3",
        "79.17",
        "37.66",
        "73.26",
        "0.2142",
        null,
        null
      ],
      [
        "DA3 + CoTracker3",
        "59.66",
        "15.12",
        "40.29",
        "0.3954",
        null,
        null
      ],
      [
        "MVMC",
        "81.14",
        "36.53",
        "77.28",
        "0.1616",
        "71.84",
        "91.20"
      ]
    ]
  }
};
