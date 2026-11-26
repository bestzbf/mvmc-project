"""Export gallery media from the existing, selected MVMC clips."""

import argparse
import io
import json
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from prepare_media import MEDIA, METHODS, only_file, save_webp


ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "assets" / "gallery"
SELECTION = Path(__file__).with_name("gallery_selection.json")
# Boxes select the predicted panels in the four source video layouts.
CROPS = {
    "pair": (.503, .15, .991, .933),
    "inputs": (.501, .465, .996, .943),
    "capture": (.506, .384, .993, .922),
    "road": (.665, .164, .994, .498),
}
EXISTING_MOVIES = {"hoi", "humman-knee", "humman-step", "dsec"}
SYNTHETIC_NOTE = "A controlled stereo scene. The left panel shows independently rendered geometry. The right panel shows the MVMC reconstruction and predicted point tracks from RGB."
SNAPSHOTS = {
    "croissant-cupcake": "附录04_*.png",
    "produce": "附录05_*.png",
}


def run(ffmpeg, *args, capture=False):
    return subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", *map(str, args)],
        check=True, capture_output=capture,
    ).stdout


def source_for(root, entry):
    if "real" in entry:
        return only_file(root / "新增实拍_仅MVMC", f"实拍{entry['real']:02d}_*.mp4")
    return only_file(root / "存档_第一批仅MVMC_50条", f"{entry['archive']:02d}_*.mp4")


def media_size(ffmpeg, file):
    probe = subprocess.run([ffmpeg, "-hide_banner", "-i", str(file)], capture_output=True)
    probe = probe.stderr.decode("utf-8", errors="replace")
    match = re.search(r"Video:.*?\b(\d{3,5})x(\d{3,5})\b", probe)
    if not match:
        raise ValueError(f"No video dimensions for {file.name}")
    return tuple(map(int, match.groups()))


def crop_box(size, layout):
    width, height = size
    return tuple(round(v * dim / 2) * 2 for v, dim in zip(CROPS[layout], (width, height, width, height)))


def export_clip(root, ffmpeg, entry):
    source = source_for(root, entry)
    slug = entry["id"]
    box = crop_box(media_size(ffmpeg, source), entry["layout"])
    if slug in EXISTING_MOVIES:
        movie = f"./assets/media/{slug}.mp4"
    else:
        run(ffmpeg, "-y", "-i", source, "-map", "0:v:0", "-an", "-sn",
            "-map_metadata", "-1", "-c:v", "copy", "-movflags", "+faststart",
            GALLERY / f"{slug}.mp4")
        movie = f"./assets/gallery/{slug}.mp4"
    frame = run(ffmpeg, "-ss", "1.15", "-i", source, "-frames:v", 1,
                "-c:v", "png", "-threads", 1, "-f", "image2pipe", "-", capture=True)
    rendered = Image.open(io.BytesIO(frame)).convert("RGB")
    preview = ImageOps.contain(rendered.crop(box), (552, 288), Image.Resampling.LANCZOS)
    card = Image.new("RGB", (552, 310), (29, 27, 23))
    card.paste(preview, ((card.width - preview.width) // 2, (card.height - preview.height) // 2))
    card.save(GALLERY / f"{slug}-thumb.webp", "WEBP", quality=88, method=6)
    rendered.thumbnail((1320, 920), Image.Resampling.LANCZOS)
    rendered.save(GALLERY / f"{slug}-poster.webp", "WEBP", quality=85, method=6)
    record = {
        "id": slug,
        "title": entry["title"],
        "category": entry["category"],
        "real": "real" in entry,
        "dataset": entry.get("dataset", "Synthetic"),
        "note": entry.get("note", SYNTHETIC_NOTE),
        "movie": movie,
    }
    return record, (source, box, entry["title"])


def export_reel(ffmpeg, parts, font_path, scratch):
    # Compose four prediction panels per shot. Each panel stays in its original aspect ratio.
    width, height = 1240, 730
    cell_w, cell_h = 616, 360
    pad = 8
    font = ImageFont.truetype(str(font_path), 23) if font_path else ImageFont.load_default(23)
    outputs = []
    positions = [(0, 0), (cell_w + pad, 0), (0, cell_h + pad), (cell_w + pad, cell_h + pad)]
    for index, row in enumerate(parts):
        label = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(label)
        built = []
        for tile, (_, box, title) in enumerate(row):
            left, top, right, bottom = box
            built.append(
                f"[{tile}:v]crop={right-left}:{bottom-top}:{left}:{top},"
                f"scale={cell_w}:{cell_h-47}:force_original_aspect_ratio=decrease,"
                f"pad={cell_w}:{cell_h}:(ow-iw)/2:0:0x1d1b17,setsar=1,"
                f"fps=24,tpad=stop_mode=clone:stop_duration=0.5,"
                f"trim=duration=2.25,setpts=PTS-STARTPTS[v{tile}]"
            )
            x, y = positions[tile]
            draw.rectangle((x, y + cell_h - 45, x + cell_w, y + cell_h), fill="#161a24")
            draw.text((x + 15, y + cell_h - 36), title, font=font, fill="#e6edfc")
        overlay = scratch / f"tiles-{index}.png"
        label.save(overlay)
        frames = "".join(f"[v{j}]" for j in range(len(row)))
        coords = "|".join(f"{x}_{y}" for x, y in positions)
        built.append(f"{frames}xstack=inputs=4:layout={coords}:fill=0x0f1420,pad={width}:{height}[grid]")
        built.append("[grid][4:v]overlay=format=auto,format=yuv420p[out]")
        cmd = [flag for source, _, _ in row for flag in ("-i", source)]
        fragment = scratch / f"part-{index}.mp4"
        run(ffmpeg, "-y", "-filter_complex_threads", 2, *cmd, "-i", overlay,
            "-filter_complex", ";".join(built), "-map", "[out]", "-an",
            "-t", "2.25", "-c:v", "libx264", "-preset", "medium", "-crf", 18,
            "-pix_fmt", "yuv420p", fragment)
        outputs.append(fragment)
    listing = scratch / "showreel-parts.txt"
    listing.write_text("".join(f"file '{path.name}'\n" for path in outputs))
    full = GALLERY / "showreel.mp4"
    run(ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", listing,
        "-c", "copy", "-movflags", "+faststart", full)
    image = run(ffmpeg, "-ss", "0.78", "-i", full, "-frames:v", 1,
                "-c:v", "png", "-threads", 1, "-f", "image2pipe", "-", capture=True)
    Image.open(io.BytesIO(image)).convert("RGB").save(GALLERY / "showreel-poster.webp", quality=91)


def export_snapshots(materials):
    MEDIA.mkdir(parents=True, exist_ok=True)
    for scene, pattern in SNAPSHOTS.items():
        source = only_file(materials, pattern)
        with Image.open(source) as original:
            panel = original.convert("RGB")
        if panel.size != (1432, 941):
            raise ValueError(f"Unexpected snapshot layout in {source.name}")
        save_webp(panel, scene + "-comparison", quality=94)
        for i, method in enumerate(METHODS):
            row, col = divmod(i, 3)
            x, y = 14 + 470 * col, 116 + 406 * row
            crop = panel.crop((x, y, x + 464, y + 350))
            save_webp(crop, f"{scene}-{method}-geometry", quality=94)
            if method == "mvmc":
                thumb = ImageOps.fit(crop, (440, 205), Image.Resampling.LANCZOS)
                save_webp(thumb, scene + "-thumb", quality=89)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--materials", required=True, type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--font", type=Path, help="TrueType font for the showreel labels")
    args = parser.parse_args()
    data = json.loads(SELECTION.read_text())
    GALLERY.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        clips = list(pool.map(lambda entry: export_clip(args.materials, args.ffmpeg, entry), data["clips"]))
    manifest = [row for row, _ in clips]
    for_frame = {row["id"]: video for row, video in clips}
    with tempfile.TemporaryDirectory(prefix="mvmc-reel-") as tmp:
        export_reel(args.ffmpeg, [[for_frame[x] for x in row] for row in data["showreel"]], args.font, Path(tmp))
    export_snapshots(args.materials)
    (ROOT / "gallery-data.js").write_text(
        "// Curated precomputed MVMC visualizations.\nexport const GALLERY = [\n"
        + ",\n".join("  " + json.dumps(row, ensure_ascii=False) for row in manifest)
        + "\n];\n", encoding="utf-8",
    )
    print(f"Exported {len(manifest)} scenes including {sum(x['real'] for x in manifest)} real captures.")


if __name__ == "__main__":
    main()
