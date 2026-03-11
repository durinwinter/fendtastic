from __future__ import annotations

import base64
from collections import deque
from io import BytesIO
from pathlib import Path
import colorsys

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path("/home/earthling/Documents/Focus/fendtastic/desired-look-prototype")
SOURCE = ROOT / "heygemini.png"


def edge_void_mask(image: Image.Image, threshold: int = 28) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    px = rgb.load()
    mask = Image.new("L", (width, height), 0)
    mp = mask.load()
    queue: deque[tuple[int, int]] = deque()

    def maybe_enqueue(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= width or y >= height:
            return
        if mp[x, y] != 0:
            return
        r, g, b = px[x, y]
        if max(r, g, b) > threshold:
            return
        mp[x, y] = 255
        queue.append((x, y))

    for x in range(width):
        maybe_enqueue(x, 0)
        maybe_enqueue(x, height - 1)
    for y in range(height):
        maybe_enqueue(0, y)
        maybe_enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        maybe_enqueue(x + 1, y)
        maybe_enqueue(x - 1, y)
        maybe_enqueue(x, y + 1)
        maybe_enqueue(x, y - 1)

    return mask


def rounded_rect_mask(size: tuple[int, int], boxes: list[tuple[int, int, int, int]], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for box in boxes:
        draw.rounded_rectangle(box, radius=radius, fill=255)
    return mask


def extract_separator(image: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    crop_box = (1620, 500, 1782, 1498)
    crop = image.crop(crop_box).convert("RGBA")
    width, height = crop.size
    mask = Image.new("L", (width, height), 0)
    src = crop.convert("RGB").load()
    mp = mask.load()

    for y in range(height):
        for x in range(width):
            r, g, b = src[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            reddish_brown = (
                0.02 <= h <= 0.12
                and s >= 0.35
                and 0.15 <= v <= 0.58
                and r > g
                and g > b
            )
            dark_detail = (
                0.03 <= h <= 0.14
                and s >= 0.18
                and 0.05 <= v <= 0.32
                and r >= g
                and g >= b
            )
            neon_green = g > 110 and g > r * 1.35 and g > b * 1.35
            if neon_green:
                mp[x, y] = 0
                continue
            if reddish_brown:
                mp[x, y] = 255
            elif dark_detail and 20 <= x <= 200:
                mp[x, y] = 160

    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.4))
    result = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    result.alpha_composite(crop)
    result.putalpha(mask)
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
        alpha = result.getchannel("A")
        trim = Image.new("L", result.size, 255)
        ImageDraw.Draw(trim).rectangle((0, 0, result.width, min(95, result.height)), fill=0)
        alpha = ImageChops.multiply(alpha, trim)
        result.putalpha(alpha)
    return result, (crop_box[0] + (bbox[0] if bbox else 0), crop_box[1] + (bbox[1] if bbox else 0))


def clear_regions(base: Image.Image, clear_mask: Image.Image) -> Image.Image:
    result = base.copy()
    alpha = result.getchannel("A")
    new_alpha = ImageChops.subtract(alpha, clear_mask)
    result.putalpha(new_alpha)
    return result


def png_to_embedded_svg(image: Image.Image, output_svg: Path) -> None:
    buf = BytesIO()
    image.save(buf, format="PNG")
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{image.width}" height="{image.height}" viewBox="0 0 {image.width} {image.height}">\n'
        f'  <image href="data:image/png;base64,{data}" width="{image.width}" height="{image.height}"/>\n'
        f'</svg>\n'
    )
    output_svg.write_text(svg, encoding="utf-8")


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")

    void_mask = edge_void_mask(source)
    base = source.copy()
    alpha = base.getchannel("A")
    alpha = ImageChops.subtract(alpha, void_mask)
    base.putalpha(alpha)

    panel_mask = rounded_rect_mask(
        base.size,
        [
            (235, 390, 805, 1265),
            (860, 390, 1655, 1265),
            (1760, 390, 2265, 1265),
        ],
        radius=60,
    )

    divider_mask = rounded_rect_mask(
        base.size,
        [
            (690, 330, 930, 1495),
            (1550, 330, 1860, 1510),
            (2110, 330, 2365, 1495),
        ],
        radius=96,
    ).filter(ImageFilter.GaussianBlur(5))

    base_frame = clear_regions(base, ImageChops.lighter(panel_mask, divider_mask))
    base_frame_png = ROOT / "base-frame.png"
    base_frame.save(base_frame_png)
    png_to_embedded_svg(base_frame, ROOT / "base-frame.svg")

    separator, offset = extract_separator(source)
    separator_png = ROOT / "separator-column.png"
    separator.save(separator_png)
    png_to_embedded_svg(separator, ROOT / "separator-column.svg")

    preview = Image.new("RGBA", source.size, (0, 0, 0, 255))
    preview.alpha_composite(base_frame)
    canvas = Image.new("RGBA", source.size, (0, 0, 0, 0))
    for x in (780, 1650):
        canvas.alpha_composite(separator, (x, offset[1]))
    preview.alpha_composite(canvas)
    preview.save(ROOT / "_debug-cut-preview.png")

    print(base_frame_png)
    print(separator_png)
    print(ROOT / "_debug-cut-preview.png")


if __name__ == "__main__":
    main()
