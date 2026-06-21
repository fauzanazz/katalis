#!/usr/bin/env python3
"""Generate isolated mascot parts via 9router gpt-5.5-image edit mode.

Pipeline per part: edit master_green (paint green over all-but-X) -> raw PNG ->
rembg matte -> parts/<name>.png. Falls back to chroma-key if rembg matte empty.
All parts share 1024x1024 canvas so stacking reconstructs the mascot.
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error

BASE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(BASE, "master", "master_green.png")
RAW = os.path.join(BASE, "raw")
PARTS = os.path.join(BASE, "parts")
LOG = os.path.join(BASE, "gen.log")

URL = os.environ["NINEROUTER_URL"].rstrip("/") + "/v1/images/generations?response_format=binary"
KEY = os.environ.get("NINEROUTER_KEY", "")
MODEL = "cx/gpt-5.5-image"

PARTS_SPEC = [
    ("01_ear-left", "the panda's left ear only (the round black furry ear on the LEFT side of the image, upper area)"),
    ("02_ear-right", "the panda's right ear only (the round black furry ear on the RIGHT side of the image, upper area)"),
    ("03_hair-tuft", "only the spiky black hair fringe on top of the forehead between the two ears"),
    ("04_head-face", "the white furry face base including the black eye patches, the small black nose, and the pink cheek blushes — but NOT the round eyeglasses, NOT the brown eyeballs, and NOT the mouth"),
    ("05_eye-left", "only the left brown eyeball with its white shine highlight (the eye on the LEFT side)"),
    ("06_eye-right", "only the right brown eyeball with its white shine highlight (the eye on the RIGHT side)"),
    ("07_mouth", "only the small smiling open mouth with the pink tongue"),
    ("08_glasses", "only the round eyeglasses (thin dark circular frames and the bridge between them)"),
    ("09_scarf", "only the orange scarf wrapped around the neck including its short hanging end"),
    ("10_body", "only the torso/body: the white belly fur and the black body fur with its outline — NOT the head, NOT the arms, NOT the legs/feet"),
    ("11_arm-left", "only the panda arm on the LEFT side of the image that holds the bottle (the black furry arm and paw) — NOT the bottle itself"),
    ("12_bottle", "only the yellow glass potion bottle with its brown cork stopper"),
    ("13_bottle-bubble", "only the small round glowing yellow bubble/sparkle floating near the top of the bottle"),
    ("14_arm-right", "only the raised waving arm on the RIGHT side of the image (the black furry arm and open paw)"),
    ("15_paw-pad", "only the pink paw pads (palm pads) on the raised open waving paw on the RIGHT side"),
    ("16_leg-left", "only the left foot/leg at the bottom of the body (black)"),
    ("17_leg-right", "only the right foot/leg at the bottom of the body (black)"),
]

PROMPT_TMPL = (
    "Edit this image. Keep the artwork pixel-identical; do NOT redraw, move, resize or restyle anything. "
    "Paint flat solid pure green (#00FF00) over the ENTIRE image EXCEPT {desc}. "
    "Keep {desc} exactly as-is in its original pixel position, size and colors. "
    "Every pixel that is not part of {desc} must become flat opaque green #00FF00. Output the same 1024x1024 composition."
)


def log(msg):
    line = f"[{int(time.time())}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def master_data_url():
    b = base64.b64encode(open(MASTER, "rb").read()).decode()
    return "data:image/png;base64," + b


def post_edit(prompt, data_url, out_path, tries=6):
    body = json.dumps({
        "model": MODEL, "prompt": prompt, "image": data_url,
        "size": "1024x1024", "output_format": "png",
    }).encode()
    for attempt in range(1, tries + 1):
        req = urllib.request.Request(URL, data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        if KEY:
            req.add_header("Authorization", "Bearer " + KEY)
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                ct = r.headers.get("Content-Type", "")
                data = r.read()
            if ct.startswith("image/"):
                open(out_path, "wb").write(data)
                return True
            # JSON error came back 200? inspect
            log(f"  non-image 200 ct={ct} body={data[:200]!r}")
        except urllib.error.HTTPError as e:
            ra = e.headers.get("retry-after")
            payload = e.read()[:200]
            wait = int(ra) + 3 if ra and ra.isdigit() else 25
            log(f"  attempt {attempt} HTTP {e.code} ra={ra} {payload!r}; sleep {wait}s")
            time.sleep(wait)
        except Exception as e:  # noqa
            log(f"  attempt {attempt} err {e}; sleep 25s")
            time.sleep(25)
    return False


def matte(raw_path, out_path):
    # rembg primary
    subprocess.run(["rembg", "i", raw_path, out_path], check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(out_path) and _fg_fraction(out_path) > 0.002:
        return "rembg"
    # fallback chroma-key (keep canvas, no trim -> registration preserved)
    subprocess.run(["magick", raw_path, "-fuzz", "16%", "-transparent", "#00FF00",
                    out_path], check=False)
    return "chroma"


def _fg_fraction(path):
    out = subprocess.run(
        ["magick", path, "-alpha", "extract", "-format", "%[fx:mean]", "info:"],
        capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def main():
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(PARTS, exist_ok=True)
    data_url = master_data_url()
    log(f"START {len(PARTS_SPEC)} parts")
    for name, desc in PARTS_SPEC:
        raw = os.path.join(RAW, name + "_green.png")
        out = os.path.join(PARTS, name + ".png")
        if os.path.exists(out):
            log(f"skip {name} (exists)")
            continue
        log(f"GEN {name}")
        ok = post_edit(PROMPT_TMPL.format(desc=desc), data_url, raw)
        if not ok:
            log(f"  FAIL {name} (no image)")
            continue
        how = matte(raw, out)
        log(f"  OK {name} matte={how} fg={_fg_fraction(out):.4f}")
        time.sleep(24)  # base cooldown between requests
    log("DONE")


if __name__ == "__main__":
    main()
