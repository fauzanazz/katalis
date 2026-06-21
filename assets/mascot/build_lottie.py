#!/usr/bin/env python3
"""Assemble the 17 mascot parts into an animated Lottie JSON.

Each part PNG is a full 512x512 canvas with its content already in the right
place, so every image layer sits at anchor=position=pivot and stacks to
reconstruct the panda. Animations: blink, arm wave, head bob, bottle bob,
breathe, ear wiggle. 150 frames @ 30fps, seamless loop.
"""
import base64, json, os

BASE = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(BASE, "parts_sm")
OUT = os.path.join(BASE, "panda.lottie.json")
W = H = 512
FR = 30
DUR_F = 150  # frames (5s loop)

EASE_IO = {"i": {"x": [0.42], "y": [1]}, "o": {"x": [0.58], "y": [0]}}


def datauri(name):
    p = os.path.join(PARTS, name + ".png")
    return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()


def kf(frames_values, dim):
    """Build keyframe list. frames_values: [(frame, [vals...]), ...]."""
    out = []
    for i, (f, v) in enumerate(frames_values):
        k = {"t": f, "s": v}
        if i < len(frames_values) - 1:
            k["i"] = {"x": [0.42] * 1, "y": [1] * 1}
            k["o"] = {"x": [0.58] * 1, "y": [0] * 1}
        out.append(k)
    return {"a": 1, "k": out}


def static(v):
    return {"a": 0, "k": v}


# part order: front (top) -> back (bottom)
ORDER = [
    "15_paw-pad", "14_arm-right", "07_mouth", "08_glasses", "06_eye-right",
    "05_eye-left", "03_hair-tuft", "04_head-face", "02_ear-right", "01_ear-left",
    "13_bottle-bubble", "12_bottle", "11_arm-left", "09_scarf",
    "17_leg-right", "16_leg-left", "10_body",
]

# pivot (anchor) per part in 512 canvas coords
PIVOT = {
    "01_ear-left": (143, 178), "02_ear-right": (332, 145),
    "03_hair-tuft": (223, 232), "04_head-face": (261, 300),
    "05_eye-left": (196, 226), "06_eye-right": (303, 205),
    "07_mouth": (266, 263), "08_glasses": (255, 212),
    "09_scarf": (274, 345), "10_body": (256, 374),
    "11_arm-left": (170, 305), "12_bottle": (137, 294),
    "13_bottle-bubble": (100, 232), "14_arm-right": (322, 240),
    "15_paw-pad": (360, 240), "16_leg-left": (199, 438), "17_leg-right": (318, 445),
}

HEAD = {"01_ear-left", "02_ear-right", "03_hair-tuft", "04_head-face",
        "05_eye-left", "06_eye-right", "07_mouth", "08_glasses"}

# head bob: gentle vertical (paired with breathe)
def head_bob(px, py):
    return [(0, [px, py]), (75, [px, py - 4]), (150, [px, py])]

assets, layers = [], []
for idx, name in enumerate(ORDER):
    refId = "img_%d" % idx
    assets.append({"id": refId, "w": W, "h": H, "u": "", "p": datauri(name), "e": 1})
    px, py = PIVOT[name]
    ks = {
        "o": static(100),
        "r": static(0),
        "p": static([px, py, 0]),
        "a": static([px, py, 0]),
        "s": static([100, 100, 100]),
    }

    # ---- per-part animation ----
    if name in ("05_eye-left", "06_eye-right"):
        # blink: squash y near frames 46 and 112; plus head bob
        ks["s"] = kf([(0, [100, 100, 100]), (44, [100, 100, 100]), (47, [100, 8, 100]),
                      (50, [100, 100, 100]), (110, [100, 100, 100]), (113, [100, 8, 100]),
                      (116, [100, 100, 100]), (150, [100, 100, 100])], 3)
        ks["p"] = kf([(f, [x, y, 0]) for f, (x, y) in
                      [(0, (px, py)), (75, (px, py - 4)), (150, (px, py))]], 3)
    elif name in ("01_ear-left", "02_ear-right"):
        sgn = 1 if name == "01_ear-left" else -1
        ks["r"] = kf([(0, [0]), (38, [sgn * 7]), (76, [0]), (114, [sgn * 7]), (150, [0])], 1)
        ks["p"] = kf([(f, [x, y, 0]) for f, (x, y) in head_bob(px, py)], 3)
    elif name in ("03_hair-tuft", "04_head-face", "07_mouth", "08_glasses"):
        ks["p"] = kf([(f, [x, y, 0]) for f, (x, y) in head_bob(px, py)], 3)
    elif name in ("14_arm-right", "15_paw-pad"):
        # wave around shoulder
        ks["r"] = kf([(0, [0]), (16, [-17]), (32, [5]), (48, [-17]), (64, [5]),
                      (80, [0]), (150, [0])], 1)
    elif name in ("12_bottle", "13_bottle-bubble"):
        ks["p"] = kf([(f, [x, y, 0]) for f, (x, y) in
                      [(0, (px, py)), (40, (px, py - 6)), (80, (px, py)),
                       (120, (px, py - 4)), (150, (px, py))]], 3)
        if name == "13_bottle-bubble":
            ks["o"] = kf([(0, [80]), (40, [100]), (80, [70]), (120, [100]), (150, [80])], 1)
            ks["s"] = kf([(0, [95, 95, 100]), (40, [108, 108, 100]), (80, [95, 95, 100]),
                          (120, [105, 105, 100]), (150, [95, 95, 100])], 3)
    elif name == "10_body":
        ks["s"] = kf([(0, [100, 100, 100]), (75, [101.5, 102.5, 100]), (150, [100, 100, 100])], 3)

    layers.append({
        "ddd": 0, "ind": idx + 1, "ty": 2, "nm": name, "refId": refId,
        "sr": 1, "ks": ks, "ao": 0, "ip": 0, "op": DUR_F, "st": 0, "bm": 0,
    })

lottie = {
    "v": "5.7.0", "fr": FR, "ip": 0, "op": DUR_F, "w": W, "h": H,
    "nm": "panda-mascot", "ddd": 0, "assets": assets, "layers": layers,
}

json.dump(lottie, open(OUT, "w"), separators=(",", ":"))
print("wrote", OUT, "bytes", os.path.getsize(OUT), "layers", len(layers))
