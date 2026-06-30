#!/usr/bin/env python3
"""Grade hossii-design eval outputs programmatically."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent

EVAL_CONFIGS = {
    "emotion-picker": {
        "assertions": {
            "uses_css_modules": lambda t, c, d: (
                any(p.name.endswith(".module.css") for p in d.glob("*.module.css"))
                and re.search(r"\.module\.css['\"]", t)
            ),
            "uses_brand_gradient_or_purple": lambda t, c, d: bool(
                re.search(r"#a855f7|#ec4899|#7c3aed", c, re.I)
            ),
            "uses_emotion_colors": lambda t, c, d: (
                "EMOTION_COLORS" in t or "emotionColors" in t
                or bool(re.search(r"#fbbf24|#60a5fa|#f472b6|#a78bfa|#10b981|#f59e0b|#8b5cf6", t + c))
            ),
            "pill_shape": lambda t, c, d: "9999px" in c or "999px" in c,
            "hossii_motion_class": lambda t, c, d: bool(
                re.search(r"hossii-(pop|soft-bounce|sparkle|float-slow)", t)
            ),
            "japanese_emotion_labels": lambda t, c, d: all(
                label in t for label in ["刺さった", "閃いた", "うれしい"]
            ),
        }
    },
    "hossii-toast": {
        "assertions": {
            "uses_css_modules": lambda t, c, d: (
                any(p.name.endswith(".module.css") for p in d.glob("*.module.css"))
                and re.search(r"\.module\.css['\"]", t)
            ),
            "glassmorphism": lambda t, c, d: (
                "backdrop-filter" in c and "blur" in c and "rgba(" in c
            ),
            "brand_gradient": lambda t, c, d: "#a855f7" in c and "#ec4899" in c,
            "hossii_copy": lambda t, c, d: bool(
                re.search(r"気持ち|Hossii", t)
            ),
            "hossii_motion": lambda t, c, d: bool(
                re.search(r"hossii-(pop|soft-bounce|sparkle|arrival)", t + c)
            ),
            "reduced_motion": lambda t, c, d: "prefers-reduced-motion" in c,
        }
    },
    "space-welcome-banner": {
        "assertions": {
            "uses_css_modules": lambda t, c, d: (
                any(p.name.endswith(".module.css") for p in d.glob("*.module.css"))
                and re.search(r"\.module\.css['\"]", t)
            ),
            "glassmorphism": lambda t, c, d: (
                "backdrop-filter" in c and "blur" in c and "rgba(" in c
            ),
            "consumer_context": lambda t, c, d: (
                bool(re.search(r"#a855f7|#ec4899|#7c3aed|#6d28d9", c))
                and "#4f46e5" not in c
                and "#f5f6fa" not in c
            ),
            "warm_japanese_copy": lambda t, c, d: bool(
                re.search(r"気持ちを置|気持ちを|ようこそ|Hossii", t)
            ),
            "pill_or_rounded": lambda t, c, d: (
                "9999px" in c or "999px" in c or re.search(r"border-radius:\s*1(\.\d+)?rem", c)
            ),
            "dismissible_or_action": lambda t, c, d: (
                "dismiss" in t.lower() or "close" in t.lower() or "閉じ" in t or "onPostClick" in t
            ),
        }
    },
}


def read_outputs(outputs_dir: Path) -> tuple[str, str]:
    texts = []
    css = []
    for p in sorted(outputs_dir.rglob("*")):
        if not p.is_file():
            continue
        if p.suffix in {".tsx", ".ts", ".css"}:
            content = p.read_text(encoding="utf-8", errors="replace")
            if p.suffix == ".css":
                css.append(content)
            else:
                texts.append(content)
    return "\n".join(texts), "\n".join(css)


def grade_eval(eval_name: str, run_dir: Path) -> dict:
    outputs_dir = run_dir / "outputs"
    tsx_text, css_text = read_outputs(outputs_dir)
    config = EVAL_CONFIGS[eval_name]
    expectations = []
    for name, fn in config["assertions"].items():
        try:
            passed = bool(fn(tsx_text, css_text, outputs_dir))
            evidence = f"Checked {name} in {len(list(outputs_dir.rglob('*')))} output files"
        except Exception as e:
            passed = False
            evidence = str(e)
        expectations.append({"text": name, "passed": passed, "evidence": evidence})

    passed = sum(1 for e in expectations if e["passed"])
    total = len(expectations)
    result = {
        "expectations": expectations,
        "summary": {
            "passed": passed,
            "failed": total - passed,
            "total": total,
            "pass_rate": round(passed / total, 4) if total else 0,
        },
    }
    grading_path = run_dir / "grading.json"
    grading_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def main():
    for eval_name in EVAL_CONFIGS:
        for variant in ("with_skill", "without_skill"):
            run_dir = ROOT / eval_name / variant
            if run_dir.exists():
                grade_eval(eval_name, run_dir)
                print(f"Graded {eval_name}/{variant}")


if __name__ == "__main__":
    main()
