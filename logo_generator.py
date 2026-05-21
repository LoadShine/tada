import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.path as mpath
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import PathPatch

try:
    from PIL import Image
except ImportError:
    import sys

    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q", "--break-system-packages"])
    from PIL import Image


OUTPUT_DIR = Path("logo_assets")
PUBLIC_DIR = Path("packages/core/public")
TAURI_ICON_DIR = Path("packages/desktop/src-tauri/icons")
DIST_PUBLIC_DIRS = [Path("packages/web/dist"), Path("packages/desktop/dist")]

LIGHT_BG = (247, 247, 245)
DARK_BG = (29, 29, 27)

THEMES = {
    "light": {
        "name": "LightMode",
        "bg": LIGHT_BG,
        "stroke": "#2c2c28",
        "dot": [
            "#0ea5b7",
            "#4f63e6",
            "#9d4edd",
            "#db3a76",
            "#dc7a26",
        ],
        "star": [
            "#e34f64",
            "#e96e45",
            "#f2a23e",
            "#e49529",
            "#d9306f",
            "#9b4de3",
            "#4965df",
            "#14a8ce",
            "#c026d3",
        ],
    },
    "dark": {
        "name": "DarkMode",
        "bg": DARK_BG,
        "stroke": "#f2f2ee",
        "dot": [
            "#5de8ff",
            "#8696ff",
            "#c778ff",
            "#ff69b8",
            "#ffc071",
        ],
        "star": [
            "#ff8392",
            "#ff9b76",
            "#ffc87c",
            "#ffc067",
            "#ff6095",
            "#c77dff",
            "#7892ff",
            "#4bddff",
            "#e056f0",
        ],
    },
}

LEGACY_TARGETS = {
    "Web_Favicon": (32, 32),
    "Web_TouchIcon": (180, 180),
    "Linux_Icon": (512, 512),
    "PC_Windows_ICO": (256, 256),
    "macOS_Icon": (1024, 1024),
    "Social_Share_Cover": (1200, 630),
}

lw = 18
color = THEMES["light"]["stroke"]
capstyle = "round"

base_y = 0.1
crossbar_top_y = 1.35

w_t = 0.5
letter_spacing = 0.6
actual_r = (crossbar_top_y - base_y) / 2
stem_top_y = 1.8


def ensure_dirs():
    for path in [
        OUTPUT_DIR,
        OUTPUT_DIR / "web",
        OUTPUT_DIR / "windows",
        OUTPUT_DIR / "linux",
        OUTPUT_DIR / "macos",
        OUTPUT_DIR / "dark" / "web",
        OUTPUT_DIR / "dark" / "linux",
        PUBLIC_DIR,
        TAURI_ICON_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def squircle_arc(xc, yc, radius_x, radius_y, n=2.2, num_points=160):
    theta = np.linspace(np.pi, 1.5 * np.pi, num_points)
    cos_t = np.cos(theta)
    sin_t = np.sin(theta)
    x = xc + radius_x * np.sign(cos_t) * (np.abs(cos_t) ** (2 / n))
    y = yc + radius_y * np.sign(sin_t) * (np.abs(sin_t) ** (2 / n))
    return x, y


def draw_t(ax, x_offset):
    hook_ry = 0.45
    yc = base_y + hook_ry

    sx, sy = squircle_arc(x_offset + w_t, yc, w_t, hook_ry, n=2.2)
    ax.plot(sx, sy, color=color, linewidth=lw, solid_capstyle=capstyle)
    ax.plot([x_offset, x_offset], [yc, stem_top_y], color=color, linewidth=lw, solid_capstyle=capstyle)

    visual_offset = 0.05
    ax.plot(
        [x_offset, x_offset + w_t],
        [crossbar_top_y - visual_offset, crossbar_top_y - visual_offset],
        color=color,
        linewidth=lw,
        solid_capstyle=capstyle,
    )
    return w_t


def draw_a(ax, x_offset):
    cy = (crossbar_top_y + base_y) / 2
    cx = x_offset + actual_r

    theta = np.linspace(0, 2 * np.pi, 240)
    ax.plot(
        cx + actual_r * np.cos(theta),
        cy + actual_r * np.sin(theta),
        color=color,
        linewidth=lw,
        solid_capstyle=capstyle,
    )

    stem_x = x_offset + 2 * actual_r
    ax.plot([stem_x, stem_x], [base_y, cy], color=color, linewidth=lw, solid_capstyle=capstyle)
    return 2 * actual_r


def draw_d(ax, x_offset):
    cy = (crossbar_top_y + base_y) / 2
    cx = x_offset + actual_r

    theta = np.linspace(0, 2 * np.pi, 240)
    ax.plot(
        cx + actual_r * np.cos(theta),
        cy + actual_r * np.sin(theta),
        color=color,
        linewidth=lw,
        solid_capstyle=capstyle,
    )

    stem_x = x_offset + 2 * actual_r
    ax.plot([stem_x, stem_x], [base_y, stem_top_y], color=color, linewidth=lw, solid_capstyle=capstyle)
    return 2 * actual_r


def arc_bezier(center, r, theta1, theta2):
    dt = theta2 - theta1
    length = (4 / 3) * np.tan(dt / 4) * r
    p0 = center + np.array([r * np.cos(theta1), r * np.sin(theta1)])
    p3 = center + np.array([r * np.cos(theta2), r * np.sin(theta2)])
    p1 = p0 + length * np.array([-np.sin(theta1), np.cos(theta1)])
    p2 = p3 - length * np.array([-np.sin(theta2), np.cos(theta2)])
    return p0, p1, p2, p3


def get_gemini_star_path(cx, cy, scale=1.0, R=0.07, alpha_deg=19, pull=0.4):
    alpha = np.radians(alpha_deg)

    c_r = np.array([1 - R, 0])
    c_t = np.array([0, 1 - R])
    c_l = np.array([-1 + R, 0])
    c_b = np.array([0, -1 + R])

    verts = []
    codes = []

    def add_bezier(p0, p1, p2, p3, is_first=False):
        if is_first:
            verts.append(p0)
            codes.append(mpath.Path.MOVETO)
        verts.extend([p1, p2, p3])
        codes.extend([mpath.Path.CURVE4] * 3)

    p0, p1, p2, p3 = arc_bezier(c_r, R, -np.pi / 2 + alpha, 0)
    add_bezier(p0, p1, p2, p3, is_first=True)
    p0, p1, p2, p3 = arc_bezier(c_r, R, 0, np.pi / 2 - alpha)
    add_bezier(p0, p1, p2, p3)

    p0 = p3
    v0 = np.array([-np.cos(alpha), np.sin(alpha)])
    p3 = c_t + np.array([R * np.cos(alpha), R * np.sin(alpha)])
    v3 = np.array([-np.sin(alpha), np.cos(alpha)])
    d = np.linalg.norm(p3 - p0)
    add_bezier(p0, p0 + d * pull * v0, p3 - d * pull * v3, p3)

    p0, p1, p2, p3 = arc_bezier(c_t, R, alpha, np.pi / 2)
    add_bezier(p0, p1, p2, p3)
    p0, p1, p2, p3 = arc_bezier(c_t, R, np.pi / 2, np.pi - alpha)
    add_bezier(p0, p1, p2, p3)

    p0 = p3
    v0 = np.array([-np.sin(alpha), -np.cos(alpha)])
    p3 = c_l + np.array([-R * np.sin(alpha), R * np.cos(alpha)])
    v3 = np.array([-np.cos(alpha), -np.sin(alpha)])
    d = np.linalg.norm(p3 - p0)
    add_bezier(p0, p0 + d * pull * v0, p3 - d * pull * v3, p3)

    p0, p1, p2, p3 = arc_bezier(c_l, R, np.pi / 2 + alpha, np.pi)
    add_bezier(p0, p1, p2, p3)
    p0, p1, p2, p3 = arc_bezier(c_l, R, np.pi, 3 * np.pi / 2 - alpha)
    add_bezier(p0, p1, p2, p3)

    p0 = p3
    v0 = np.array([np.cos(alpha), -np.sin(alpha)])
    p3 = c_b + np.array([-R * np.cos(alpha), -R * np.sin(alpha)])
    v3 = np.array([np.sin(alpha), -np.cos(alpha)])
    d = np.linalg.norm(p3 - p0)
    add_bezier(p0, p0 + d * pull * v0, p3 - d * pull * v3, p3)

    p0, p1, p2, p3 = arc_bezier(c_b, R, np.pi + alpha, 3 * np.pi / 2)
    add_bezier(p0, p1, p2, p3)
    p0, p1, p2, p3 = arc_bezier(c_b, R, 3 * np.pi / 2, 2 * np.pi - alpha)
    add_bezier(p0, p1, p2, p3)

    p0 = p3
    v0 = np.array([np.sin(alpha), np.cos(alpha)])
    p3 = c_r + np.array([R * np.sin(alpha), -R * np.cos(alpha)])
    v3 = np.array([np.cos(alpha), np.sin(alpha)])
    d = np.linalg.norm(p3 - p0)
    add_bezier(p0, p0 + d * pull * v0, p3 - d * pull * v3, p3)

    verts.append(verts[0])
    codes.append(mpath.Path.CLOSEPOLY)

    verts = np.array(verts, dtype=float)
    verts *= scale
    verts[:, 0] += cx
    verts[:, 1] += cy

    return mpath.Path(verts, codes)


def build_iridescent_rgb(extent, anchors, nx=1200, ny=1200):
    xmin, xmax, ymin, ymax = extent
    xs = np.linspace(xmin, xmax, nx)
    ys = np.linspace(ymin, ymax, ny)
    X, Y = np.meshgrid(xs, ys)

    rgb = np.zeros((ny, nx, 3), dtype=float)
    wsum = np.zeros((ny, nx), dtype=float)

    for (anchor_x, anchor_y), hex_color, sigma in anchors:
        color_rgb = (
            np.array(
                [
                    int(hex_color[1:3], 16),
                    int(hex_color[3:5], 16),
                    int(hex_color[5:7], 16),
                ]
            )
            / 255.0
        )
        weight = np.exp(-((X - anchor_x) ** 2 + (Y - anchor_y) ** 2) / (2.0 * sigma**2))
        wsum += weight
        rgb += weight[..., None] * color_rgb

    rgb /= wsum[..., None] + 1e-12
    return np.clip(rgb, 0.0, 1.0)


def theme_anchors(theme, center_x, center_y, radius, kind):
    colors = theme[kind]
    if kind == "star":
        positions = [
            (-0.72, 0.08, 0.26),
            (-0.38, 0.62, 0.24),
            (0.03, 0.84, 0.20),
            (0.56, 0.26, 0.24),
            (0.45, -0.18, 0.26),
            (0.06, -0.06, 0.26),
            (-0.18, -0.54, 0.22),
            (0.00, -0.86, 0.20),
            (-0.42, -0.20, 0.24),
        ]
    else:
        positions = [
            (-0.55, 0.50, 0.38),
            (0.28, 0.52, 0.36),
            (0.55, 0.05, 0.38),
            (0.12, -0.52, 0.38),
            (-0.48, -0.10, 0.40),
        ]
    return [
        ((center_x + px * radius, center_y + py * radius), hex_color, sigma * radius)
        for (px, py, sigma), hex_color in zip(positions, colors)
    ]


def draw_logo(ax, theme):
    global color
    color = theme["stroke"]

    x_current = 0
    x_current += draw_t(ax, x_current) + letter_spacing
    x_current += draw_a(ax, x_current) + letter_spacing

    x_d = x_current
    w_d = draw_d(ax, x_current)
    d_stem_x = x_d + 2 * actual_r
    x_current += w_d + letter_spacing

    x_last_a = x_current
    w_last_a = draw_a(ax, x_current)
    text_end_x = x_last_a + w_last_a

    dot_x = d_stem_x
    dot_y = stem_top_y + 0.78
    r_dot = 0.18

    R_star = 0.8
    star_y = stem_top_y + 1.98
    star_x = text_end_x - R_star

    star_path = get_gemini_star_path(star_x, star_y, scale=R_star, R=0.07, alpha_deg=19, pull=0.4)
    dot_path = mpath.Path.circle(center=(dot_x, dot_y), radius=r_dot)

    star_patch = PathPatch(star_path, facecolor="none", edgecolor="none")
    dot_patch = PathPatch(dot_path, facecolor="none", edgecolor="none")
    ax.add_patch(star_patch)
    ax.add_patch(dot_patch)

    star_extent = [
        star_x - R_star * 1.05,
        star_x + R_star * 1.05,
        star_y - R_star * 1.05,
        star_y + R_star * 1.05,
    ]
    star_rgb = build_iridescent_rgb(star_extent, theme_anchors(theme, star_x, star_y, R_star, "star"), nx=1400, ny=1400)
    star_im = ax.imshow(star_rgb, extent=star_extent, origin="lower", interpolation="bicubic")
    star_im.set_clip_path(star_patch)

    dot_extent = [
        dot_x - r_dot * 1.2,
        dot_x + r_dot * 1.2,
        dot_y - r_dot * 1.2,
        dot_y + r_dot * 1.2,
    ]
    dot_rgb = build_iridescent_rgb(dot_extent, theme_anchors(theme, dot_x, dot_y, r_dot, "dot"), nx=700, ny=700)
    dot_im = ax.imshow(dot_rgb, extent=dot_extent, origin="lower", interpolation="bicubic")
    dot_im.set_clip_path(dot_patch)

    x_pad = 1.1
    y_pad = 1.05

    min_x = -x_pad
    max_x = text_end_x + x_pad
    min_y = base_y - y_pad
    max_y = star_y + R_star + y_pad

    side_length = max(max_x - min_x, max_y - min_y)
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    ax.set_xlim(center_x - side_length / 2, center_x + side_length / 2)
    ax.set_ylim(center_y - side_length / 2, center_y + side_length / 2)


def render_base_png(theme, output_path, size=2048):
    dpi = 256
    fig = plt.figure(figsize=(size / dpi, size / dpi), dpi=dpi)
    fig.patch.set_alpha(0)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_aspect("equal")
    ax.axis("off")
    ax.patch.set_alpha(0)
    draw_logo(ax, theme)
    fig.savefig(output_path, dpi=dpi, transparent=True, facecolor=(0, 0, 0, 0), edgecolor="none")
    plt.close(fig)


def render_svg(theme, output_path, transparent=False):
    fig = plt.figure(figsize=(6, 6), dpi=144)
    if transparent:
        fig.patch.set_alpha(0)
    else:
        fig.patch.set_facecolor(tuple(channel / 255 for channel in theme["bg"]))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_aspect("equal")
    ax.axis("off")
    if transparent:
        ax.patch.set_alpha(0)
    else:
        ax.set_facecolor(tuple(channel / 255 for channel in theme["bg"]))
    draw_logo(ax, theme)
    fig.savefig(output_path, format="svg", transparent=transparent, facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close(fig)

    bg_hex = "#{:02x}{:02x}{:02x}".format(*theme["bg"])
    svg = output_path.read_text()
    marker = f"<!-- Tada brand logo; background {bg_hex}; wordmark Tada -->\n"
    svg = svg.replace(">", ">\n" + marker, 1)
    output_path.write_text(svg)


def composite_icon(base_image, size, bg=None):
    resized = base_image.resize((size, size), Image.Resampling.LANCZOS)
    if bg is None:
        return resized
    canvas = Image.new("RGBA", (size, size), (*bg, 255))
    canvas.alpha_composite(resized)
    return canvas


def save_png(base_image, output_path, size, bg=None):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    composite_icon(base_image, size, bg).save(output_path)


def save_ico(base_image, output_path, bg):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    icon = composite_icon(base_image, 256, bg)
    icon.save(output_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def save_icns(base_image, output_path, bg):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "Tada.iconset"
        iconset.mkdir()
        sizes = [
            ("icon_16x16.png", 16),
            ("icon_16x16@2x.png", 32),
            ("icon_32x32.png", 32),
            ("icon_32x32@2x.png", 64),
            ("icon_128x128.png", 128),
            ("icon_128x128@2x.png", 256),
            ("icon_256x256.png", 256),
            ("icon_256x256@2x.png", 512),
            ("icon_512x512.png", 512),
            ("icon_512x512@2x.png", 1024),
        ]
        for filename, size in sizes:
            composite_icon(base_image, size, bg).save(iconset / filename)

        if shutil.which("iconutil"):
            subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(output_path)], check=True)
        else:
            composite_icon(base_image, 1024, bg).save(output_path, format="ICNS")


def save_legacy_matrix(theme_key, theme, base_image):
    theme_name = theme["name"]
    render_svg(theme, OUTPUT_DIR / f"logo_full_{theme_name}.svg", transparent=False)
    render_svg(theme, OUTPUT_DIR / f"logo_full_{theme_name}_transparent.svg", transparent=True)

    for target_name, dims in LEGACY_TARGETS.items():
        width, height = dims
        if width == height:
            save_png(base_image, OUTPUT_DIR / f"icon_{theme_name}_{target_name}_{width}x{height}.png", width)
            save_png(base_image, OUTPUT_DIR / f"icon_{theme_name}_bg_{target_name}_{width}x{height}.png", width, theme["bg"])
            save_png(base_image, OUTPUT_DIR / f"full_{theme_name}_{target_name}_{width}x{height}.png", width)
            save_png(base_image, OUTPUT_DIR / f"full_{theme_name}_bg_{target_name}_{width}x{height}.png", width, theme["bg"])
            continue

        icon_size = int(min(width, height) * 0.62)
        scaled = composite_icon(base_image, icon_size)
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        bg_canvas = Image.new("RGBA", (width, height), (*theme["bg"], 255))
        offset = ((width - icon_size) // 2, (height - icon_size) // 2)
        canvas.alpha_composite(scaled, offset)
        bg_canvas.alpha_composite(scaled, offset)
        canvas.save(OUTPUT_DIR / f"full_{theme_name}_{target_name}_{width}x{height}.png")
        bg_canvas.save(OUTPUT_DIR / f"full_{theme_name}_bg_{target_name}_{width}x{height}.png")

    if theme_key == "light":
        shutil.copyfile(OUTPUT_DIR / f"logo_full_{theme_name}.svg", OUTPUT_DIR / "logo.svg")
        composite_icon(base_image, 2048).save(OUTPUT_DIR / "logo_transparent.png")
        composite_icon(base_image, 2048, theme["bg"]).save(OUTPUT_DIR / "logo.png")


def save_platform_assets(base_image, theme, prefix=OUTPUT_DIR):
    save_png(base_image, prefix / "web" / "favicon-32.png", 32, theme["bg"])
    save_png(base_image, prefix / "web" / "apple-touch-icon.png", 180, theme["bg"])
    save_png(base_image, prefix / "web" / "icon-512.png", 512, theme["bg"])
    save_png(base_image, prefix / "linux" / "icon.png", 512, theme["bg"])
    save_png(base_image, prefix / "macos" / "icon.png", 1024, theme["bg"])
    save_ico(base_image, prefix / "windows" / "icon.ico", theme["bg"])
    save_icns(base_image, prefix / "macos" / "icon.icns", theme["bg"])


def sync_tada_assets(light_base, dark_base):
    light = THEMES["light"]
    dark = THEMES["dark"]

    shutil.copyfile(OUTPUT_DIR / "logo.svg", Path("logo.svg"))
    shutil.copyfile(OUTPUT_DIR / "logo.svg", PUBLIC_DIR / "logo.svg")
    composite_icon(light_base, 2048).save(PUBLIC_DIR / "logo_transparent.png")
    composite_icon(dark_base, 2048, dark["bg"]).save(PUBLIC_DIR / "logo_white.png")

    shutil.copyfile(OUTPUT_DIR / "logo.svg", PUBLIC_DIR / "tray-icon.svg")
    save_png(light_base, TAURI_ICON_DIR / "tray-icon.png", 44, light["bg"])

    for dist_dir in DIST_PUBLIC_DIRS:
        if dist_dir.exists():
            shutil.copyfile(OUTPUT_DIR / "logo.svg", dist_dir / "logo.svg")
            composite_icon(light_base, 2048).save(dist_dir / "logo_transparent.png")
            composite_icon(dark_base, 2048, dark["bg"]).save(dist_dir / "logo_white.png")
            shutil.copyfile(OUTPUT_DIR / "logo.svg", dist_dir / "tray-icon.svg")

    save_png(light_base, TAURI_ICON_DIR / "32x32.png", 32, light["bg"])
    save_png(light_base, TAURI_ICON_DIR / "128x128.png", 128, light["bg"])
    save_png(light_base, TAURI_ICON_DIR / "128x128@2x.png", 256, light["bg"])
    save_png(light_base, TAURI_ICON_DIR / "256x256.png", 256, light["bg"])
    save_ico(light_base, TAURI_ICON_DIR / "icon.ico", light["bg"])
    save_icns(light_base, TAURI_ICON_DIR / "icon.icns", light["bg"])


def main():
    ensure_dirs()

    rendered = {}
    for theme_key, theme in THEMES.items():
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp:
            temp_path = Path(temp.name)
        try:
            render_base_png(theme, temp_path, size=2048)
            base_image = Image.open(temp_path).convert("RGBA")
            rendered[theme_key] = base_image.copy()
        finally:
            temp_path.unlink(missing_ok=True)

        save_legacy_matrix(theme_key, theme, rendered[theme_key])

    save_platform_assets(rendered["light"], THEMES["light"], OUTPUT_DIR)
    save_platform_assets(rendered["dark"], THEMES["dark"], OUTPUT_DIR / "dark")
    sync_tada_assets(rendered["light"], rendered["dark"])
    composite_icon(rendered["light"], 2048, THEMES["light"]["bg"]).save("tada_logo_integrated_gemini_star_v5.png")

    print("Tada logo assets generated.")


if __name__ == "__main__":
    main()
