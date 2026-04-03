"""
Generate all bingo call audio files using Microsoft Edge TTS.
Produces MP3 files for both EN/ES, 75-ball and 90-ball variants.

Output structure:
  apps/client/public/audio/calls/en/75/B-1.mp3 ... O-75.mp3
  apps/client/public/audio/calls/es/75/B-1.mp3 ... O-75.mp3
  apps/client/public/audio/calls/en/90/1.mp3   ... 90.mp3
  apps/client/public/audio/calls/es/90/1.mp3   ... 90.mp3
"""

import asyncio
import os
import edge_tts

# Voices - high quality Microsoft Neural voices
EN_VOICE = "en-US-GuyNeural"       # Clear male English voice
ES_VOICE = "es-MX-JorgeNeural"     # Clear male Mexican Spanish voice

LETTERS = ["B", "I", "N", "G", "O"]
OUTPUT_BASE = os.path.join(os.path.dirname(__file__), "..", "apps", "client", "public", "audio", "calls")

# ─── English number words ───

ENGLISH_ONES = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
]
ENGLISH_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

def number_to_english(n: int) -> str:
    if n < 20:
        return ENGLISH_ONES[n]
    tens = n // 10
    ones = n % 10
    return ENGLISH_TENS[tens] if ones == 0 else f"{ENGLISH_TENS[tens]} {ENGLISH_ONES[ones]}"

# ─── Spanish number words ───

SPANISH_ONES = [
    "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince", "diecis\u00e9is",
    "diecisiete", "dieciocho", "diecinueve",
]
SPANISH_TWENTIES = [
    "veinte", "veintiuno", "veintid\u00f3s", "veintitr\u00e9s", "veinticuatro",
    "veinticinco", "veintis\u00e9is", "veintisiete", "veintiocho", "veintinueve",
]
SPANISH_TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]

def number_to_spanish(n: int) -> str:
    if n < 20:
        return SPANISH_ONES[n]
    if 20 <= n <= 29:
        return SPANISH_TWENTIES[n - 20]
    tens = n // 10
    ones = n % 10
    return SPANISH_TENS[tens] if ones == 0 else f"{SPANISH_TENS[tens]} y {SPANISH_ONES[ones]}"


async def generate_file(text: str, voice: str, output_path: str):
    """Generate a single TTS audio file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    communicate = edge_tts.Communicate(text, voice, rate="-10%")
    await communicate.save(output_path)


async def main():
    tasks = []

    # ─── 75-ball: "B, one" ... "O, seventy five" ───
    for n in range(1, 76):
        letter = LETTERS[(n - 1) // 15]
        # English
        en_text = f"{letter} ... {number_to_english(n)}"
        en_path = os.path.join(OUTPUT_BASE, "en", "75", f"{letter}-{n}.mp3")
        tasks.append(generate_file(en_text, EN_VOICE, en_path))
        # Spanish
        es_text = f"{letter} ... {number_to_spanish(n)}"
        es_path = os.path.join(OUTPUT_BASE, "es", "75", f"{letter}-{n}.mp3")
        tasks.append(generate_file(es_text, ES_VOICE, es_path))

    # ─── 90-ball: just the number ───
    for n in range(1, 91):
        # English
        en_text = number_to_english(n)
        en_path = os.path.join(OUTPUT_BASE, "en", "90", f"{n}.mp3")
        tasks.append(generate_file(en_text, EN_VOICE, en_path))
        # Spanish
        es_text = number_to_spanish(n)
        es_path = os.path.join(OUTPUT_BASE, "es", "90", f"{n}.mp3")
        tasks.append(generate_file(es_text, ES_VOICE, es_path))

    # Run in batches to avoid overwhelming the API
    BATCH_SIZE = 20
    total = len(tasks)
    for i in range(0, total, BATCH_SIZE):
        batch = tasks[i:i + BATCH_SIZE]
        await asyncio.gather(*batch)
        done = min(i + BATCH_SIZE, total)
        print(f"  Generated {done}/{total} files...")

    print(f"\nDone! {total} audio files generated in {OUTPUT_BASE}")


if __name__ == "__main__":
    asyncio.run(main())
