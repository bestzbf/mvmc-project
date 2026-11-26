"""Build the compressed media and benchmark table for the static site."""

import argparse
import io
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "assets" / "media"

MOVIES = {
    "hoi": "实拍01_*.mp4",
    "humman-knee": "实拍02_*.mp4",
    "humman-step": "实拍03_*.mp4",
    "dsec": "实拍04_*.mp4",
}
COMPARISONS = {
    "whale-cat": "附录09_*.png",
    "ray-vase": "附录07_*.png",
    "wheel-statue": "附录08_*.png",
}
METHODS = ("reference", "mvmc", "fourrc", "omnix", "mvtracker", "trackeverything")


def only_file(directory, pattern):
    paths = list(directory.glob(pattern))
    if len(paths) != 1:
        raise ValueError(f"Expected one file matching {directory / pattern}, found {len(paths)}")
    return paths[0]


def save_webp(image, name, quality=91, width=None):
    image = image.convert("RGB")
    if width and image.width > width:
        image.thumbnail((width, image.height), Image.Resampling.LANCZOS)
    image.save(MEDIA / f"{name}.webp", "WEBP", quality=quality, method=6)


def prepare_movie(ffmpeg, source, name):
    # The supplied clips already use H.264. Fast-start keeps seeking responsive
    # and stripping metadata keeps the published copy limited to demo content.
    target = MEDIA / f"{name}.mp4"
    subprocess.run(
        [ffmpeg, "-v", "error", "-y", "-i", str(source), "-map", "0:v:0",
         "-an", "-sn", "-map_metadata", "-1", "-c:v", "copy", "-movflags", "+faststart", str(target)],
        check=True,
    )
    poster = subprocess.run(
        [ffmpeg, "-v", "error", "-ss", "0.8", "-i", str(target), "-frames:v", "1",
         "-c:v", "png", "-threads", "1", "-f", "image2pipe", "-"],
        capture_output=True, check=True,
    ).stdout
    image = Image.open(io.BytesIO(poster)).convert("RGB")
    save_webp(image, f"{name}-poster", width=1380)
    # Keep the action and reference panel in the compact selector thumbnail.
    image = ImageOps.fit(image, (424, 208), Image.Resampling.LANCZOS, centering=(.5, .57))
    save_webp(image, f"{name}-thumb", quality=85)


def prepare_comparison(source, name):
    panel = Image.open(source).convert("RGB")
    if panel.size != (2096, 1150):
        raise ValueError(f"Unexpected comparison layout in {source.name}")
    save_webp(panel, f"{name}-comparison", quality=94)
    for index, method in enumerate(METHODS):
        row, column = divmod(index, 3)
        x = 25 + 688 * column
        y = 215 + 429 * row
        for kind, left, width in [("geometry", x, 312), ("tracks", x + 320, 327)]:
            crop = panel.crop((left, y, left + width, y + 346))
            save_webp(crop, f"{name}-{method}-{kind}", quality=94)
            if kind == "geometry" and method == "mvmc":
                thumb = ImageOps.fit(crop.crop((12, 32, 300, 298)), (300, 160), Image.Resampling.LANCZOS)
                save_webp(thumb, f"{name}-thumb")
                if name != "wheel-statue":
                    save_webp(crop, f"{name}-preview")


def prepare_framework(source):
    import pypdfium2

    doc = pypdfium2.PdfDocument(source)
    page = doc[0]
    bitmap = page.render(scale=2300 / page.get_width())
    image = bitmap.to_pil().convert("RGB")
    save_webp(image, "framework", quality=95)
    print("Framework pixels:", image.size)
    bitmap.close()
    page.close()
    doc.close()


def prepare_benchmark(source):
    data = source.read_text(encoding="utf-8")
    table = data.split(r"\label{tab:multicamera_results}", 1)[1].split(r"\end{tabular*}", 1)[0]
    rows = []
    for line in table.splitlines():
        cells = line.split(" & ")
        if len(cells) != 13 or cells[0].strip() == "Method":
            continue
        name = re.sub(r"~\\cite\{[^}]+\}", "", cells[0].strip())
        name = name.replace(r"$\Omega$", "Ω").replace(r"\textbf{\method{}}", "MVMC")
        scores = []
        for cell in cells[1:]:
            cell = re.sub(r"\\cellcolor\{[^}]+\}", "", cell).strip().removesuffix(r"\\").strip()
            if cell == r"\textemdash":
                scores.append(None)
            else:
                float(cell)
                scores.append(cell)
        rows.append([name, *scores])
    if len(rows) != 9 or rows[-1][0] != "MVMC":
        raise ValueError("Table 1 did not match the expected nine-method structure")
    datasets = {
        "kubric": {
            "label": "MV-Kubric", "context": "30 clips · 24 frames",
            "rows": [[name, *scores[6:]] for name, *scores in rows],
        },
        "panoptic": {
            "label": "Panoptic", "context": "6 clips · 150 frames",
            "rows": [[name, *scores[:6]] for name, *scores in rows],
        },
    }
    (ROOT / "metrics.js").write_text(
        "// Multi-camera RGB-only tracking metrics, transcribed from Table 1.\n"
        + "export const BENCHMARKS = " + json.dumps(datasets, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def prepare_identity(font_file):
    def mark(draw, x, y, width, background):
        step = width // 6
        size = width - 2 * step
        for index, color in enumerate(("#f2f6ff", "#ccd9ff", "#284bd1")):
            x1, y1 = x + step * index, y + step * index
            draw.rounded_rectangle(
                (x1, y1, x1 + size, y1 + size), radius=max(3, size // 6),
                fill=color if index else background, outline="#284bd1", width=max(2, width // 18),
            )

    icon = Image.new("RGB", (72, 72), "#f2f6ff")
    mark(ImageDraw.Draw(icon), 10, 10, 52, "#f2f6ff")
    icon.save(MEDIA / "icon.png")

    card = Image.new("RGB", (1200, 630), "#eef3ff")
    draw = ImageDraw.Draw(card)
    mark(draw, 80, 85, 49, "#eef3ff")
    # The export font may be supplied by the system when recreating these
    # graphics. The page itself loads Instrument Sans as a local web font.
    system_font = Path("/System/Library/Fonts/Helvetica.ttc")
    if not font_file and system_font.is_file():
        font_file = system_font
    def font(size):
        return ImageFont.truetype(str(font_file), size) if font_file else ImageFont.load_default(size)
    draw.text((143, 80), "MVMC", fill="#172242", font=font(48))
    draw.text((78, 198), "Multi-View 4D", fill="#172242", font=font(67))
    draw.text((78, 273), "Reconstruction", fill="#172242", font=font(67))
    draw.text((78, 348), "and Tracking", fill="#284bd1", font=font(67))
    draw.text((82, 464), "From unposed multi-camera videos", fill="#53617c", font=font(28))
    cloud = Image.open(MEDIA / "whale-cat-mvmc-geometry.webp").convert("RGB")
    cloud = ImageOps.fit(cloud, (435, 445), Image.Resampling.LANCZOS)
    mask = Image.new("L", cloud.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 434, 444), radius=22, fill=255)
    card.paste(cloud, (684, 93), mask)
    card.save(MEDIA / "share-card.jpg", quality=92, optimize=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--materials", required=True, type=Path)
    parser.add_argument("--framework", required=True, type=Path)
    parser.add_argument("--table", required=True, type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--export-font", type=Path)
    args = parser.parse_args()
    MEDIA.mkdir(parents=True, exist_ok=True)
    for name, pattern in MOVIES.items():
        prepare_movie(args.ffmpeg, only_file(args.materials / "新增实拍_仅MVMC", pattern), name)
    for name, pattern in COMPARISONS.items():
        prepare_comparison(only_file(args.materials / "附录_动态追踪版", pattern), name)
    prepare_framework(args.framework)
    prepare_benchmark(args.table)
    prepare_identity(args.export_font)


if __name__ == "__main__":
    main()
