#!/usr/bin/env python3
"""Benchmark latency and token speed for candidate OpenRouter models.

Sends the same prompts the app builds in app/api/llm/route.ts (define /
simplify / translate actions) with sample text from the bundled book
"The Keeper of Cape Mire", streams the responses, and reports:

  - TTFT (time to first token)
  - generation speed (output tokens / second, after first token)
  - end-to-end tokens / second
  - total latency and cost per request

Stdlib only, no third-party dependencies.

Usage:
  python scripts/bench_openrouter.py
  python scripts/bench_openrouter.py --runs 3 --warmup 1 --actions define,translate
  python scripts/bench_openrouter.py --models z-ai/glm-5.3-flash

The key is read from the OPENROUTER_API_KEY environment variable or from
OPENROUTER_API_KEY=... in .env.local at the project root.
"""

import argparse
import base64
import json
import os
import ssl
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_MODELS = [
    "z-ai/glm-5.3-flash",
    "deepseek/deepseek-v4-flash-0731",
    "nvidia/nemotron-3.5-lightning",
    "google/gemini-2.5-flash-lite",
]

ALL_ACTIONS = ["define", "simplify", "translate"]

# Common CA bundle locations on Windows (Git for Windows, msys2), used when
# Python's own trust store is empty (typical for msys2/mingw64 Python builds
# without the ca-certificates package).
COMMON_CA_BUNDLES = [
    r"C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt",
    r"C:\Program Files\Git\usr\ssl\certs\ca-bundle.pem",
    r"C:\Program Files\Git\mingw64\share\ca-bundle.crt",
    r"C:\msys64\mingw64\etc\ssl\cert.pem",
    r"C:\msys64\usr\etc\ssl\certs\ca-bundle.crt",
    r"C:\msys64\etc\ssl\certs\ca-bundle.crt",
]

# Mirrors production request params in app/api/llm/route.ts POST().
TEMPERATURE = 0.3
DEFAULT_MAX_TOKENS = 600
MAX_CONTEXT_SENTENCE = 400

# Simulated selection + context, taken from the sample book shipped with the
# reader (scripts/make-sample-epub.mjs), as if the user selected the word
# "superstitious" while reading.
SAMPLE_TERM = "superstitious"
SAMPLE_IS_WORD = True
SAMPLE_PREV = (
    "But the key did not turn, no matter how I coaxed it, and when I pressed "
    "my ear to the wood I thought I could hear the sea on the other side, "
    "which was impossible, because the sea was fifty yards away and down a cliff."
)
SAMPLE_CURRENT = "I am not a superstitious man."
SAMPLE_NEXT = (
    "I had taken this post precisely because I wanted quiet, and because the "
    "advertisement had promised quiet in capital letters."
)


def cap_sentence(s: str) -> str:
    t = s.strip()
    return t if len(t) <= MAX_CONTEXT_SENTENCE else t[:MAX_CONTEXT_SENTENCE] + "..."


def build_context_block(prev: str, current: str, nxt: str) -> str:
    lines = []
    if prev:
        lines.append(f"Previous sentence: {prev}")
    if current:
        lines.append(f"Current sentence: {current}")
    if nxt:
        lines.append(f"Next sentence: {nxt}")
    if not lines:
        return ""
    return "\n\nContext:\n" + "\n".join(lines)


def build_prompt(action: str, target_language: str = "en-zh"):
    """Mirror of buildPrompt() in app/api/llm/route.ts."""
    term = SAMPLE_TERM.strip()
    context = build_context_block(
        cap_sentence(SAMPLE_PREV),
        cap_sentence(SAMPLE_CURRENT),
        cap_sentence(SAMPLE_NEXT),
    )
    is_word = SAMPLE_IS_WORD or (not any(ch.isspace() for ch in term))
    type_label = "single word" if is_word else "phrase"

    if action == "simplify":
        return (
            "You are a reading assistant. Rewrite only the selected text into "
            "plain, simple English that is easy to understand while preserving "
            "the original meaning. Use the surrounding context only to resolve "
            "references and pick the correct meaning; do not add information "
            "that is not in the text, and do not simplify or rewrite anything "
            "outside the selected text. If the selected text is a single word "
            "or short fragment, give a brief plain-English explanation of what "
            "it means in this context instead of rewriting it.",
            f'Text to simplify: {term}{context}\n\nReturn JSON {{"result": '
            '"<simplified or explained text>", "example": ""}',
        )

    if action == "define":
        return (
            "You are a precise English dictionary. Given a single word in "
            "context, return its most common part(s) of speech and concise "
            "definitions that fit how it is used in the provided context, plus "
            "one short example sentence using the word naturally.",
            f'Word: {term}{context}\n\nReturn JSON {{"result": "<word> - (part '
            'of speech) definition; definition", "example": "<example sentence '
            'using the word>"}',
        )

    if action == "translate":
        if target_language == "en-zh":
            return (
                "You are an English-Chinese translator and language tutor. "
                "Translate the selected word or phrase into Chinese, choosing "
                "the meaning that best fits the provided context. If the "
                "selected text is a single word, also state its part of speech "
                "as used in context. Then give one short example sentence in "
                "English together with its Chinese translation.",
                f'Selected text ({type_label}): {term}{context}\n\nReturn JSON '
                '{"result": "<Chinese translation, with part of speech in '
                'parentheses if a single word>", "example": "<English sentence> '
                '- <中文翻译>"}',
            )
        return (
            "You are an English-English language tutor. Give a concise "
            "definition of the selected word or phrase that fits how it is "
            "used in the provided context, then one short example sentence "
            "using it naturally.",
            f'Selected text ({type_label}): {term}{context}\n\nReturn JSON '
            '{"result": "<concise definition>", "example": "<example sentence '
            'using the term>"}',
        )

    raise ValueError(f"Unknown action: {action}")


def load_api_key(explicit: str | None) -> str | None:
    if explicit:
        return explicit.strip()
    env = os.environ.get("OPENROUTER_API_KEY")
    if env:
        return env.strip()
    env_file = Path(__file__).resolve().parent.parent / ".env.local"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("OPENROUTER_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if value:
                    return value
    return None


def build_ssl_context(insecure: bool = False) -> tuple[ssl.SSLContext, str]:
    """Return (context, source) with working CA certs despite common Windows issues."""
    if insecure:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx, "insecure (verification disabled)"

    # 1. certifi, if installed.
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where()), f"certifi ({certifi.where()})"
    except ImportError:
        pass

    # 2. An SSL_CERT_FILE that actually exists (broken env vars are handled below).
    candidates = []
    cafile = os.environ.get("SSL_CERT_FILE", "")
    if cafile:
        candidates.append(cafile)
    candidates.extend(COMMON_CA_BUNDLES)
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return ssl.create_default_context(cafile=candidate), f"CA bundle ({candidate})"

    # 3. Default behavior. Pops SSL_CERT_FILE/SSL_CERT_DIR first so a stale or
    #    unexpanded value (e.g. "%VIRTUAL_ENV%\\...") cannot zero out the trust
    #    store, then falls back to the Windows certificate stores.
    for var in ("SSL_CERT_FILE", "SSL_CERT_DIR"):
        os.environ.pop(var, None)
    ctx = ssl.create_default_context()
    if len(ctx.get_ca_certs()) == 0 and sys.platform == "win32":
        for store in ("CA", "ROOT"):
            try:
                entries = ssl.enum_certificates(store)
            except (AttributeError, OSError):
                continue
            for der, encoding, _trust in entries:
                if encoding != "x509_asn":
                    continue
                pem = base64.encodebytes(der).decode("ascii")
                try:
                    ctx.load_verify_locations(
                        cadata=f"-----BEGIN CERTIFICATE-----\n{pem}-----END CERTIFICATE-----\n"
                    )
                except ssl.SSLError:
                    continue
        if len(ctx.get_ca_certs()) > 0:
            return ctx, "Windows certificate store"
    elif len(ctx.get_ca_certs()) > 0:
        return ctx, "system default"

    return ctx, "no trusted CAs found"


def stream_completion(api_key, model, system, user, max_tokens, timeout, ssl_ctx):
    """Stream one chat completion; returns a metrics dict. Raises on errors."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": TEMPERATURE,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "stream": True,
        "usage": {"include": True},
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "ebook-ai-reader bench",
    }
    req = urllib.request.Request(
        API_URL, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
    )

    t0 = time.perf_counter()
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {body}") from None

    ttft = None
    first_at = None
    last_at = None
    usage = None
    content_chars = 0
    content_chunks = 0
    with resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line or line.startswith(":"):
                continue
            if not line.startswith("data:"):
                continue
            data_str = line[len("data:"):].strip()
            if data_str == "[DONE]":
                break
            try:
                event = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            if event.get("error"):
                raise RuntimeError(f"stream error: {event['error']}")
            choices = event.get("choices") or [{}]
            delta = choices[0].get("delta") or {}
            content = delta.get("content")
            if content:
                now = time.perf_counter()
                if first_at is None:
                    first_at = now
                    ttft = now - t0
                last_at = now
                content_chunks += 1
                content_chars += len(content)
            if event.get("usage"):
                usage = event["usage"]
    total = time.perf_counter() - t0

    prompt_tokens = (usage or {}).get("prompt_tokens")
    completion_tokens = (usage or {}).get("completion_tokens")
    if completion_tokens is None:
        # Rough fallback (~4 chars/token) if usage accounting is unavailable.
        completion_tokens = max(1, round(content_chars / 4))

    gen_time = (last_at - first_at) if (first_at is not None and last_at) else None
    gen_speed = completion_tokens / gen_time if gen_time else None
    overall_speed = completion_tokens / total if total > 0 else None

    return {
        "ttft": ttft,
        "total": total,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "gen_speed": gen_speed,
        "overall_speed": overall_speed,
        "cost": (usage or {}).get("cost"),
        "content": content_chars,
    }


def fmt(value, digits=2, suffix=""):
    if value is None:
        return "-"
    return f"{value:.{digits}f}{suffix}"


def percentile(values, pct):
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    rank = (len(ordered) - 1) * pct / 100.0
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    frac = rank - low
    return ordered[low] + (ordered[high] - ordered[low]) * frac


def mean(values):
    return statistics.fmean(values) if values else None


def run_bench(args, api_key, ssl_ctx):
    actions = [a.strip() for a in args.actions.split(",") if a.strip()]
    for a in actions:
        if a not in ALL_ACTIONS:
            raise SystemExit(f"Unknown action '{a}'. Valid: {', '.join(ALL_ACTIONS)}")
    models = [m.strip() for m in args.models.split(",") if m.strip()] or DEFAULT_MODELS

    results = {}
    for model in models:
        print(f"\n=== {model} ===")
        per_run = []

        for w in range(args.warmup):
            system, user = build_prompt(actions[0])
            try:
                stream_completion(
                    api_key, model, system, user, args.max_tokens, args.timeout, ssl_ctx
                )
                print(f"  warmup {w + 1}/{args.warmup}: ok")
            except Exception as e:
                print(f"  warmup {w + 1}/{args.warmup}: FAILED ({e})")

        for i in range(args.runs):
            action = actions[i % len(actions)]
            system, user = build_prompt(action)
            try:
                m = stream_completion(
                    api_key, model, system, user, args.max_tokens, args.timeout, ssl_ctx
                )
                per_run.append(m)
                print(
                    f"  run {i + 1}/{args.runs} [{action:9s}] "
                    f"ttft {fmt(m['ttft'], 3, 's')}  "
                    f"total {fmt(m['total'], 2, 's')}  "
                    f"out {m['completion_tokens']:>4} tok  "
                    f"gen {fmt(m['gen_speed'], 1, ' tok/s')}  "
                    f"e2e {fmt(m['overall_speed'], 1, ' tok/s')}  "
                    f"cost {fmt(m['cost'], 6, '$')}"
                )
            except Exception as e:
                print(f"  run {i + 1}/{args.runs} [{action:9s}] FAILED ({e})")

        results[model] = per_run

    return results


def print_summary(results):
    print("\n" + "=" * 108)
    print("SUMMARY (per successful run)")
    print("=" * 108)
    header = (
        f"{'model':<34} {'ok':>3} {'ttft med':>9} {'ttft p95':>9} "
        f"{'total med':>10} {'out tok':>8} {'gen tok/s':>10} {'e2e tok/s':>10} {'cost/run':>10}"
    )
    print(header)
    print("-" * 108)

    ranked = []
    for model, runs in results.items():
        if not runs:
            print(f"{model:<34}   0   (all runs failed)")
            continue
        ttfts = [r["ttft"] for r in runs if r["ttft"] is not None]
        totals = [r["total"] for r in runs]
        out_toks = [r["completion_tokens"] for r in runs]
        gen = [r["gen_speed"] for r in runs if r["gen_speed"]]
        e2e = [r["overall_speed"] for r in runs if r["overall_speed"]]
        costs = [r["cost"] for r in runs if r["cost"] is not None]
        print(
            f"{model:<34} {len(runs):>3} "
            f"{fmt(mean(ttfts), 3):>9} {fmt(percentile(ttfts, 95), 3):>9} "
            f"{fmt(mean(totals)):>10} {fmt(mean(out_toks), 0):>8} "
            f"{fmt(mean(gen), 1):>10} {fmt(mean(e2e), 1):>10} "
            f"{fmt(mean(costs), 6):>10}"
        )
        ranked.append(
            {
                "model": model,
                "ttft": mean(ttfts),
                "gen": mean(gen),
                "e2e": mean(e2e),
                "total": mean(totals),
            }
        )

    if ranked:
        by_ttft = sorted(ranked, key=lambda r: r["ttft"] if r["ttft"] is not None else 9e9)
        by_gen = sorted(ranked, key=lambda r: -(r["gen"] or 0))
        print("\nFastest TTFT:        ", by_ttft[0]["model"], f"({fmt(by_ttft[0]['ttft'], 3, 's')} median)")
        print("Fastest generation:  ", by_gen[0]["model"], f"({fmt(by_gen[0]['gen'], 1, ' tok/s')} median)")


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Benchmark OpenRouter models for ebook-ai-reader prompts.")
    parser.add_argument("--models", default="", help="Comma-separated model IDs (default: the 4 candidates)")
    parser.add_argument("--runs", type=int, default=3, help="Measured runs per model (default: 3)")
    parser.add_argument("--warmup", type=int, default=1, help="Discarded warmup runs per model (default: 1)")
    parser.add_argument("--actions", default="define,simplify,translate",
                        help=f"Comma-separated actions to cycle through: {','.join(ALL_ACTIONS)}")
    parser.add_argument("--target", default="en-zh", choices=["en-zh", "en-en"],
                        help="Target language for the translate action (default: en-zh)")
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS)
    parser.add_argument("--timeout", type=int, default=90, help="Per-request timeout in seconds")
    parser.add_argument("--key", default="", help="OpenRouter API key (else env / .env.local)")
    parser.add_argument("--insecure", action="store_true",
                        help="Disable TLS certificate verification (last resort only)")
    args = parser.parse_args()

    api_key = load_api_key(args.key or None)
    if not api_key:
        print("ERROR: no OpenRouter API key found.", file=sys.stderr)
        print("Set OPENROUTER_API_KEY (env) or add it to .env.local.", file=sys.stderr)
        return 1

    ssl_ctx, ssl_source = build_ssl_context(args.insecure)
    print(f"OpenRouter benchmark | runs={args.runs} warmup={args.warmup} "
          f"actions={args.actions} max_tokens={args.max_tokens}")
    print(f"TLS trust source: {ssl_source}")
    if ssl_source == "no trusted CAs found" and not args.insecure:
        print("ERROR: no CA certificates available. Fix by removing the broken "
              "SSL_CERT_FILE env var or 'pip install certifi'.", file=sys.stderr)
        print("You can also rerun with --insecure (not recommended).", file=sys.stderr)
        return 1

    results = run_bench(args, api_key, ssl_ctx)
    print_summary(results)
    return 0 if any(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
