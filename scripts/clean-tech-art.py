"""Очистка рисунков техники: убрать запечённые тени и белые края.

Запуск: /path/to/venv/bin/python scripts/clean-tech-art.py [--dry-run]
Требуются Pillow, numpy, scipy.

Что и почему:
- У машин/кораблей под корпусом нарисован серый «овал-тень» на бумаге: на
  цветных подиумах приложения он торчит белым пятном за силуэт. Тень
  срезается поколоночно снизу вверх: снимается только нейтрально-серый слой
  от нижнего края колонки до первого тёмного/цветного контура (шина, корпус,
  ватерлиния — барьер). Белая краска кузова защищена отдельным правилом:
  высокий нейтральный столбик считается краской, а не тенью.
- У ноутбука фон — бумажный лист целиком: он заливается от краёв кадра
  только по почти-белым кремовым пикселям, серебристый корпус темнее порога.
- У ТВ белая «поверхность стола» под экраном — одна большая почти-белая
  область, касающаяся нижнего края рисунка; экран защищён тёмной рамкой.
- У арктического самолёта снежная поверхность под лыжами убирается отдельной
  маской по линии брюха фюзеляжа (единственный файл с ручной геометрией).
- Белый ореол по контуру (полупрозрачные засвеченные пиксели выреза) красится
  в цвет ближайшего непрозрачного пикселя предмета — край остаётся мягким,
  но перестаёт светиться белым на тёмном и цветном фоне.
- Мелкий бумажный крап (отдельные компоненты < 160 px) и тонкие «сосульки»
  по нижнему краю убираются морфологией только в нижней полосе кадра,
  чтобы не трогать антенны, мачты и стойки шасси выше неё.

Размеры холстов не меняются: посадка на подиумы и общая линия пола у машин
сохраняются. Файлы перезаписываются на месте (WebP, quality=92).
"""

import glob
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

DRY = "--dry-run" in sys.argv


def _segment(cand_col, opaque_col, yb, speckle, hard):
    """Сегмент-кандидат снизу вверх от yb; допускает тёмный крап ≤ speckle px."""
    y, gap, top, cnt = yb, 0, None, 0
    while y >= 0 and (yb - y) < hard:
        if not opaque_col[y]:
            break
        if cand_col[y]:
            gap, top, cnt = 0, y, cnt + 1
        else:
            gap += 1
            if gap > speckle:
                break
        y -= 1
    if top is None:
        return None
    seg = yb - top + 1
    return top, seg, cnt / seg


def bottom_up_shadow(rgba, max_run, sat_max=18, v_lo=55, v_hi_a=235,
                     speckle=3, min_frac=0.5):
    """Снять нейтральную тень/бумагу снизу каждой колонки до контура предмета.

    Высокий нейтральный сегмент (> max_run) — это краска/серебро кузова:
    тогда снимается только средне-серая нижняя часть (собственно тень).
    """
    a = rgba.astype(np.int16)
    mx = a[:, :, :3].max(axis=2)
    sat = mx - a[:, :, :3].min(axis=2)
    opaque = a[:, :, 3] > 10
    cand_all = opaque & (sat <= sat_max) & (mx >= v_lo)
    cand_a = opaque & (sat <= sat_max) & (mx >= v_lo) & (mx <= v_hi_a)
    out, removed = rgba.copy(), 0
    for x in range(opaque.shape[1]):
        col = np.where(opaque[:, x])[0]
        if len(col) == 0:
            continue
        yb = int(col[-1])
        s = _segment(cand_all[:, x], opaque[:, x], yb, speckle, hard=max_run * 3)
        if s and s[1] <= max_run and s[2] >= min_frac:
            out[s[0]:yb + 1, x] = 0
            removed += s[1]
            continue
        s2 = _segment(cand_a[:, x], opaque[:, x], yb, speckle, hard=max_run * 2)
        if s2 and s2[1] <= int(max_run * 1.2) and s2[2] >= min_frac:
            out[s2[0]:yb + 1, x] = 0
            removed += s2[1]
    return out, removed / opaque.size


def spike_filter(rgba, thresh=5, max_width=5, keep=3):
    """Узкие (≤5 колонок) выступы ниже локального нижнего профиля — остатки тени."""
    m = rgba[:, :, 3] > 10
    w = m.shape[1]
    yb = np.full(w, -1)
    for x in range(w):
        col = np.where(m[:, x])[0]
        if len(col):
            yb[x] = col[-1]
    med = ndimage.median_filter(yb.astype(float), size=7, mode="nearest")
    over = (yb - med > thresh) & (yb >= 0)
    out, removed, x = rgba.copy(), 0, 0
    while x < w:
        if over[x]:
            x0 = x
            while x < w and over[x]:
                x += 1
            if x - x0 <= max_width:
                for xx in range(x0, x):
                    cut = int(med[xx]) + keep
                    if yb[xx] > cut:
                        out[cut + 1:yb[xx] + 1, xx] = 0
                        removed += yb[xx] - cut
        else:
            x += 1
    return out, removed / m.size


def band_opening(rgba, band=48):
    """Срезать 1–2-пиксельные «сосульки» только в нижней полосе кадра."""
    m = rgba[:, :, 3] > 10
    if not m.any():
        return rgba, 0.0
    bottom = np.where(m.any(axis=1))[0][-1]
    opened = ndimage.binary_opening(m, structure=np.ones((2, 3), bool))
    kill = np.zeros_like(m)
    y0 = max(0, bottom - band)
    kill[y0:] = m[y0:] & ~opened[y0:]
    out = rgba.copy()
    out[kill] = 0
    return out, kill.mean()


def border_paper_flood(rgba):
    """Бумажный фон ноутбука: заливка от краёв по почти-белым пикселям."""
    a = rgba.astype(np.int16)
    mx = a[:, :, :3].max(axis=2)
    sat = mx - a[:, :, :3].min(axis=2)
    alpha = a[:, :, 3]
    cand = (alpha == 0) | ((sat <= 25) & (mx >= 228))
    lab, _ = ndimage.label(cand)
    border = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    kill = np.isin(lab, border[border > 0]) & (alpha > 0)
    out = rgba.copy()
    out[kill] = 0
    return out, kill.mean()


def tv_paper_wedge(rgba):
    """Белая «поверхность» под ТВ: большая почти-белая область у нижнего края."""
    a = rgba.astype(np.int16)
    mx = a[:, :, :3].max(axis=2)
    sat = mx - a[:, :, :3].min(axis=2)
    alpha = a[:, :, 3]
    opaque = alpha > 10
    cand = opaque & (mx >= 195) & (sat <= 28)
    lab, n = ndimage.label(cand)
    if n == 0:
        return rgba, 0.0
    bottommost = np.zeros_like(opaque)
    for x in range(opaque.shape[1]):
        col = np.where(opaque[:, x])[0]
        if len(col):
            bottommost[col[-1], x] = True
    sizes = ndimage.sum(cand, lab, range(1, n + 1))
    touch = ndimage.maximum(bottommost, lab, range(1, n + 1))
    kill_ids = [i + 1 for i in range(n) if sizes[i] > 1500 and touch[i] > 0]
    kill = np.isin(lab, kill_ids)
    # Серый крап внутри клина — в пределах 2 px от снятой области.
    near = ndimage.binary_dilation(kill, structure=np.ones((3, 3), bool), iterations=2)
    kill |= near & opaque & (mx >= 135) & (sat <= 40)
    out = rgba.copy()
    out[kill] = 0
    return out, kill.mean()


ARCTIC_PLANE_ZONE = [(125, 472), (260, 462), (420, 452), (560, 442), (680, 424),
                     (780, 400), (860, 434), (980, 454), (1062, 478), (1080, 520),
                     (1080, 630), (85, 630), (95, 520)]
ARCTIC_PLANE_KEEP = [(98, 508, 352, 610), (423, 503, 777, 637), (303, 453, 507, 527)]


def arctic_plane_snow(im):
    """Снежная поверхность под лыжами: маска по линии брюха + заливка снега.

    Лыжи и колёса защищены тёмными контурами и keep-прямоугольниками вокруг
    стоек; снег между стойками снимается как яркие нейтральные острова зоны.
    """
    h, w = im.shape[:2]
    a = im.astype(np.int16)
    mx, sat = a[:, :, :3].max(axis=2), a[:, :, :3].max(axis=2) - a[:, :, :3].min(axis=2)
    alpha = im[:, :, 3]
    zone_img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(zone_img).polygon(ARCTIC_PLANE_ZONE, fill=255)
    zone = np.asarray(zone_img) > 0
    keep_img = Image.new("L", (w, h), 0)
    kd = ImageDraw.Draw(keep_img)
    for box in ARCTIC_PLANE_KEEP:
        kd.rectangle(box, fill=255)
    keep = np.asarray(keep_img) > 0

    snow = (alpha > 10) & (mx >= 150) & (sat <= 85) & zone
    closed = ndimage.binary_closing(snow, structure=np.ones((3, 3), bool)) & zone & (alpha > 10)
    lab, _ = ndimage.label(closed)
    seeds = np.unique(lab[600:630, :])
    flood = np.isin(lab, seeds[seeds > 0])
    flood = (ndimage.binary_dilation(flood, structure=np.ones((3, 3), bool))
             & (alpha > 10) & zone & (mx >= 120) & (sat <= 95))
    out = im.copy()
    out[flood] = 0

    def snow_like(arr):
        aa = arr.astype(np.int16)
        mm = aa[:, :, :3].max(axis=2)
        return mm, mm - aa[:, :, :3].min(axis=2)

    mx2, sat2 = snow_like(out)
    out[(out[:, :, 3] > 10) & (mx2 >= 205) & (sat2 <= 65) & zone & ~keep] = 0

    mx3, sat3 = snow_like(out)
    snow3 = (out[:, :, 3] > 10) & (mx3 >= 150) & (sat3 <= 85) & zone & ~keep
    lab, n = ndimage.label(ndimage.binary_closing(snow3, structure=np.ones((3, 3), bool)))
    if n:
        sizes = ndimage.sum(snow3, lab, range(1, n + 1))
        kill = (np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 30])
                & (out[:, :, 3] > 10) & zone & ~keep & (mx3 >= 120))
        out[kill] = 0

    # Отдельные снежные кляксы под лыжами (не главная компонента самолёта).
    m = out[:, :, 3] > 10
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        cents = ndimage.center_of_mass(m, lab, range(1, n + 1))
        kill_ids = [i + 1 for i in range(n)
                    if i + 1 != main and cents[i][0] > 440 and sizes[i] < 5000]
        out[np.isin(lab, kill_ids)] = 0

    removed = (im[:, :, 3] > 10) & (out[:, :, 3] <= 10)
    return out, removed.mean()


def drop_tiny_components(rgba, min_area=160):
    m = rgba[:, :, 3] > 10
    lab, n = ndimage.label(m)
    if n <= 1:
        return rgba, 0.0
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    kill = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < min_area])
    out = rgba.copy()
    out[kill] = 0
    return out, kill.mean()


def defringe(rgba):
    """Белый ореол: полупрозрачные почти-белые пиксели красятся цветом предмета."""
    out = rgba.copy()
    alpha = out[:, :, 3]
    out[alpha < 10] = 0
    alpha = out[:, :, 3]
    a = out.astype(np.int16)
    mx = a[:, :, :3].max(axis=2)
    sat = mx - a[:, :, :3].min(axis=2)
    fringe = (alpha >= 10) & (alpha < 250) & (mx >= 205) & (sat <= 28)
    solid = alpha >= 250
    if fringe.any() and solid.any():
        _, idx = ndimage.distance_transform_edt(~solid, return_indices=True)
        nearest = out[idx[0], idx[1]]
        out[:, :, :3] = np.where(fringe[:, :, None], nearest[:, :, :3], out[:, :, :3])
    return out


def process(path):
    im = np.asarray(Image.open(path).convert("RGBA"))
    h = im.shape[0]
    name = os.path.basename(path)
    total = 0.0
    if name == "plane-arctic-base.webp":
        im, f = arctic_plane_snow(im)
        total += f
    elif "/cars/" in path:
        im, f = bottom_up_shadow(im, max_run=58)
        total += f
        im, f = spike_filter(im)
        total += f
        im, f = band_opening(im, band=48)
        total += f
    elif "/ships/" in path:
        im, f = bottom_up_shadow(im, max_run=42)
        total += f
        im, f = spike_filter(im)
        total += f
        im, f = band_opening(im, band=36)
        total += f
    elif "/planes/" in path:
        im, f = bottom_up_shadow(im, max_run=int(h * 0.13), sat_max=26)
        total += f
    elif name == "laptop-air.webp":
        im, f = border_paper_flood(im)
        total += f
        im, f = bottom_up_shadow(im, max_run=12, sat_max=25, v_lo=100,
                                 speckle=1, min_frac=0.7)
        total += f
        im, f = spike_filter(im)
        total += f
        im, f = band_opening(im, band=200)
        total += f
        im, f = profile_trim(im, window=31, thresh=3, keep=1)
        total += f
    elif name == "headphones-max.webp":
        im, f = bottom_up_shadow(im, max_run=22, sat_max=22, v_lo=170,
                                 speckle=3, min_frac=0.55)
        total += f
        im, f = band_opening(im, band=90)
        total += f
        im, f = profile_trim(im, window=61, thresh=4, keep=2)
        total += f
    elif name == "tv-cinema.webp":
        im, f = tv_paper_wedge(im)
        total += f
        im, f = band_opening(im, band=240)
        total += f
    # Телефоны (phone-*.webp) — эталонно чистые вырезы: только крап и ореол.
    im, f = drop_tiny_components(im)
    total += f
    im = defringe(im)
    print(f"{path}: снято {total * 100:.2f}% пикселей")
    if not DRY:
        Image.fromarray(im).save(path, quality=92, method=6)
        print(f"  -> {os.path.getsize(path)} байт")


def main():
    files = []
    for folder in ("cars", "ships", "planes", "electronics"):
        files += sorted(glob.glob(f"public/{folder}/*.webp"))
    for path in files:
        process(path)


if __name__ == "__main__":
    main()
