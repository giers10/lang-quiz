#!/usr/bin/env python3
"""
gemini_replicate_batch.py

Batch-generate <ID>.json files for Instagram reels using Replicate's
google/gemini-2.5-flash model with dynamic_thinking enabled.

Input:  data/**/<ID>.mp4        (any subfolder under data)
Output: data/**/<ID>.json       (parsed JSON, next to video)
        data/**/<ID>.raw.txt    (raw model output, next to video)

Usage:
  python3 gemini_replicate_batch.py --data data
  python3 gemini_replicate_batch.py --data data --only-missing
  python3 gemini_replicate_batch.py --data data --prompt-file prompt.txt
  python3 gemini_replicate_batch.py --data data --max-output-tokens 12000
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import replicate


DEFAULT_PROMPT = r"""
You analyze an Instagram-style Japanese language video.
The video is either Japanese-only or English+Japanese.

Goal: Create a compact learning JSON for a custom quiz website.
The website will ask the user questions; if the user is wrong or taps "Don't know",
we will show the explanation from this JSON and the original IG media.

TOKEN BUDGET:
Be concise. Do not duplicate explanations inside questions.

STRICT RULES:
1) Do not invent. Only include words/phrases/grammar that clearly appear in the video.
2) For every Japanese string containing kanji, provide a full hiragana reading in a separate field "kana".
3) Keep it small:
   - grammar: max 2
   - vocab: max 10
   - conversation lines: max 10
   - key_phrases: max 10
4) NO timestamps. NO evidence_quote. NO source fields. NO confidence fields.
5) Questions MUST reference items by id (do not repeat long explanations in questions).
6) Provide 1–3 questions per item (depending on usefulness). Prefer: cloze, multiple choice, match, register-choice.

OUTPUT:
Return ONLY valid JSON (no markdown). UTF-8 Japanese.

SCHEMA:

{
  "meta": {
    "mode": "ja_only|en+ja",
    "type": "grammar|vocab|conversation|mixed|unknown",
    "title_en": "short title (5-8 words max)"
  },
  "items": {
    "grammar": [
      {
        "id": "g1",
        "pattern": "string",
        "meaning_en": "one line",
        "use_note_en": "1-2 lines max",
        "register": "polite|neutral|casual|slang|formal|unknown",
        "example": { "jp": "string", "kana": "string", "en": "string" }
      }
    ],
    "vocab": [
      {
        "id": "v1",
        "jp": "surface form",
        "kana": "hiragana reading",
        "meaning_en": "short",
        "register": "polite|neutral|casual|slang|formal|unknown",
        "note_en": "optional, 1 line max",
        "example": { "jp": "optional", "kana": "optional", "en": "optional" }
      }
    ],
    "conversation": [
      {
        "id": "c1",
        "jp": "exact line",
        "kana": "hiragana reading",
        "en": "translation",
        "register": "polite|neutral|casual|slang|mixed|unknown"
      }
    ],
    "key_phrases": [
      {
        "id": "k1",
        "jp": "phrase",
        "kana": "reading",
        "meaning_en": "short",
        "when_to_use_en": "1-2 lines max",
        "register": "polite|neutral|casual|slang|formal|unknown"
      }
    ]
  },
  "quiz": [
    {
      "id": "q1",
      "targets": ["k1"],
      "type": "mc_meaning|mc_register|cloze|match|choose_best_reply",
      "prompt_en": "string",
      "payload": {
        "sentence_jp": "optional",
        "sentence_kana": "optional",
        "blanked": "optional",
        "options": ["A","B","C","D"],
        "pairs": [{"left":"","right":""}]
      },
      "answer": {
        "correct_index": 0,
        "correct_text": "optional"
      }
    }
  ],
  "ui_hints": {
    "recommended_order": ["g1","k1","v1"],
    "show_first": "quiz",
    "explain_on_fail": true
  }
}

QUESTION GUIDELINES:
- For each grammar item: at least 1 cloze question + 1 meaning/usage question.
- For vocab/key_phrases: at least 1 meaning MC and optionally 1 register/situation question.
- For conversation lines: optionally “what does this mean” or “best reply”.
- Keep prompts short. Do not restate long explanations (shown after fail).

Return ONLY the JSON object. No markdown fences.
""".strip()


def load_env_files(paths: list[Path]) -> None:
    """
    Load simple KEY=VALUE pairs from one or more .env files without
    overriding existing environment variables.
    """
    seen = set()
    for path in paths:
        try:
            resolved = path.resolve()
        except FileNotFoundError:
            continue
        if resolved in seen or not resolved.exists():
            continue
        seen.add(resolved)

        for line in resolved.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip().removeprefix("export ").strip()
            value = value.strip()
            if value and len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            if key:
                os.environ.setdefault(key, value)


def strip_code_fences(text: str) -> str:
    # Remove ```json ... ``` or ``` ... ```
    text = text.strip()
    text = re.sub(r"^\s*```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text)
    return text.strip()


def extract_json_object(text: str) -> Dict[str, Any]:
    """
    Try to recover JSON if the model wrapped it with text or fences.
    """
    cleaned = strip_code_fences(text)

    # If it's already pure JSON:
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Otherwise, take substring from first { to last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Could not locate JSON object in model output.")

    snippet = cleaned[start : end + 1].strip()
    return json.loads(snippet)


def validate_minimal_schema(obj: Dict[str, Any]) -> None:
    # Minimal checks only (Gemini can be slightly variable)
    if not isinstance(obj, dict):
        raise ValueError("Top-level JSON is not an object.")
    for key in ("meta", "items", "quiz"):
        if key not in obj:
            raise ValueError(f"Missing required top-level key: {key}")
    if "title_en" not in obj["meta"]:
        raise ValueError("meta.title_en missing")
    if not isinstance(obj["quiz"], list):
        raise ValueError("quiz must be an array")


def run_gemini_on_video(
    video_path: Path,
    video_url: str,
    prompt: str,
    *,
    top_p: float,
    temperature: float,
    dynamic_thinking: bool,
    max_output_tokens: int,
    client: replicate.Client,
    prefer_wait_seconds: Optional[int] = None,
) -> str:
    """
    Calls Replicate model and returns raw text output.
    """
    inp = {
        "top_p": top_p,
        "temperature": temperature,
        "dynamic_thinking": dynamic_thinking,
        "max_output_tokens": max_output_tokens,
        "prompt": prompt,
        "images": [],
        "videos": [video_url],
    }

    try:
        out = client.run("google/gemini-2.5-flash", input=inp)
        if isinstance(out, str):
            return out
        if isinstance(out, list):
            return "".join(str(x) for x in out)
        return str(out)
    except Exception as e:
        raise RuntimeError(f"Replicate call failed for {video_path.name}: {e}") from e


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data", help="Data directory containing .mp4 files (default: data)")
    ap.add_argument("--prompt-file", default=None, help="Optional prompt.txt to override the default prompt")
    ap.add_argument("--only-missing", action="store_true", help="Only process videos without an existing .json")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing .json outputs")
    ap.add_argument("--sleep", type=float, default=0.0, help="Sleep seconds between requests (default: 0)")
    ap.add_argument("--top-p", type=float, default=0.95)
    ap.add_argument("--temperature", type=float, default=0.7)
    ap.add_argument("--dynamic-thinking", action="store_true", default=True,
                    help="Enable dynamic_thinking (default: ON)")
    ap.add_argument("--max-output-tokens", type=int, default=12000,
                    help="Max output tokens (default: 12000; raise if you need bigger JSON)")
    ap.add_argument("--remote-base-url", default=None,
                    help="Base URL where the --data tree is mirrored (e.g., https://example.com/data)")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    load_env_files([Path.cwd() / ".env", script_dir / ".env"])

    token = os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY")
    if token and not os.environ.get("REPLICATE_API_TOKEN"):
        os.environ["REPLICATE_API_TOKEN"] = token  # replicate library expects this name
    if not token:
        print("ERROR: REPLICATE_API_TOKEN not set.", file=sys.stderr)
        sys.exit(2)

    base_url = args.remote_base_url or os.environ.get("REMOTE_BASE_URL")
    if not base_url:
        print("ERROR: --remote-base-url or REMOTE_BASE_URL env var is required (public URL of mirrored data)", file=sys.stderr)
        sys.exit(2)
    base_url = base_url.rstrip("/")

    client = replicate.Client()

    data_dir = Path(args.data).expanduser().resolve()
    if not data_dir.exists():
        print(f"ERROR: data dir not found: {data_dir}", file=sys.stderr)
        sys.exit(2)

    prompt = DEFAULT_PROMPT
    if args.prompt_file:
        prompt_path = Path(args.prompt_file).expanduser().resolve()
        prompt = prompt_path.read_text(encoding="utf-8").strip()

    mp4s = sorted(data_dir.rglob("*.mp4"))
    if not mp4s:
        print(f"No .mp4 files found under {data_dir}")
        return

    print(f"Found {len(mp4s)} videos under {data_dir}")

    for video_path in mp4s:
        stem = video_path.stem
        out_json = video_path.with_suffix(".json")
        out_raw = video_path.with_suffix(".raw.txt")
        rel_video = video_path.relative_to(data_dir)
        video_url = f"{base_url}/{rel_video.as_posix()}"

        if out_json.exists() and args.only_missing:
            print(f"SKIP (exists): {rel_video}")
            continue
        if out_json.exists() and (not args.overwrite) and (not args.only_missing):
            print(f"SKIP (use --overwrite to replace): {rel_video}")
            continue

        # Quick size warning for local uploads
        size_mb = video_path.stat().st_size / (1024 * 1024)
        if size_mb > 150:
            print(f"WARNING: {video_path.name} is {size_mb:.1f}MB (>150MB). "
                  f"Downloads from the remote server may be slow.")

        print(f"RUN: {rel_video}")

        try:
            raw = run_gemini_on_video(
                video_path,
                video_url,
                prompt,
                top_p=args.top_p,
                temperature=args.temperature,
                dynamic_thinking=True,  # you asked for this explicitly
                max_output_tokens=args.max_output_tokens,
                client=client,
            )

            out_raw.write_text(raw, encoding="utf-8")

            obj = extract_json_object(raw)
            validate_minimal_schema(obj)

            out_json.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"OK  -> {out_json.relative_to(data_dir)}")

        except Exception as e:
            print(f"FAIL: {video_path.name}: {e}", file=sys.stderr)
            # keep raw if we got it
            if out_raw.exists():
                print(f"      Raw output saved: {out_raw.name}", file=sys.stderr)

        if args.sleep > 0:
            time.sleep(args.sleep)


if __name__ == "__main__":
    main()
