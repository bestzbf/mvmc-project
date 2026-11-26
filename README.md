# MVMC project website

[Open the interactive website](https://bestzbf.github.io/mvmc-project/) · [MVMC model and code](https://github.com/bestzbf/mvmc)

This project page presents *Multi-View 4D Reconstruction and Tracking from Unposed Multi-Camera Videos*. It includes two interactive 3D reconstructions, four real-world clips, three qualitative comparison scenes, and the RGB-only multi-camera tracking benchmarks.

## Preview

Start the local server from the repository root.

    python3 -m http.server 8000

[Open the preview](http://localhost:8000/). GitHub Pages serves the project from the root of the main branch.

## Demo data

- **3D viewer.** The two synthetic examples show MVMC checkpoint 231,100 and an independently rendered reference. Both use input RGB colors, foreground masks for display, and one fixed scene alignment for comparison. Each sequence has 24 frames and six point trajectories. [Scene metadata](assets/scenes/) gives the protocol, credit URLs, and frame indices. The binary point streams use little-endian float32 XYZ and three uint8 RGB values with one padding byte per point.
- **Real sequences.** Hoi! is credited under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), the DSEC montage under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), and HuMMan-Recon under the [S-Lab License](assets/licenses/humman.txt). The site credits the data providers and displays the reference type for each clip.
- **Qualitative comparisons.** The interactive panels are crops of the included full figures. Geometry panels show one frame and trajectory panels summarize 24 frames. The scene assets are from [Poly Haven](https://polyhaven.com/license) under CC0.
- **Benchmark results.** The site reproduces Table 1 for MV-Kubric and Panoptic at the reported precision. An em dash marks an unavailable score. [Metric data](metrics.js)

Edit [index.html](index.html) for changes to the project text. To rebuild the posters, clips, figure crops, and benchmark table from the original material, use Python 3.9+, Pillow, pypdfium2, and FFmpeg. The preparation script accepts the materials folder, architecture figure, and Table 1 source as inputs. [Media preparation](scripts/prepare_media.py)

    python3 scripts/prepare_media.py --help
