# MVMC project website

[Open the interactive website](https://bestzbf.github.io/mvmc-project/) · [MVMC model and code](https://github.com/bestzbf/mvmc)

This project page presents *Multi-View 4D Reconstruction and Tracking from Unposed Multi-Camera Videos*. It includes a highlight reel, six interactive 3D reconstructions, a filterable library of 30 clips, five qualitative comparisons, and the RGB-only multi-camera tracking benchmarks.

## Preview

Start the local server from the repository root.

    python3 -m http.server 8000

[Open the preview](http://localhost:8000/). GitHub Pages serves the project from the root of the main branch.

## Demo data

- **3D viewer.** The fox and robot and train and tram scenes have independently rendered geometry and tracks. The DSEC and HuMMan-Recon scenes have measured depth views. The SceneHub4D couch and N3DV cooking scenes show predicted geometry and trajectories with point colors sampled from their RGB views. [Scene metadata](assets/scenes/) gives the display protocol, credit URLs, and frame indices. The binary point streams use little-endian float32 XYZ and three uint8 RGB values with one padding byte per point.
- **Motion gallery.** Seven clips show real captures and 23 show controlled synthetic scenes. The SceneHub4D clip is rendered from the interactive 3D data. Separate thumbnails and a highlight reel use cropped previews. [Media credits](assets/licenses/scene-credits.html)
- **Qualitative comparisons.** The interactive panels are crops of the included full figures. Some show trajectories across the full sequence and others overlay tracked points on one frame.
- **Benchmark results.** The site reproduces Table 1 for MV-Kubric and Panoptic at the reported precision. An em dash marks an unavailable score. [Metric data](metrics.js)

Edit [index.html](index.html) for changes to the project text. To rebuild the posters, clips, figure crops, and benchmark table from the original material, use Python 3.9+, Pillow, pypdfium2, and FFmpeg. The preparation script accepts the materials folder, architecture figure, and Table 1 source as inputs. [Media preparation](scripts/prepare_media.py)

    python3 scripts/prepare_media.py --help
    python3 scripts/prepare_gallery.py --help
