"""
IITJ Google Directory Scraper — Production Pipeline
=====================================================
Based on yogeshs9/GoogleContactsDirectoryScraper approach.
Uses scrollIntoView() on the last contact element to force data loading.

Features:
  • Resumable    — progress saved to JSONL; picks up where it left off
  • Robust       — graceful SIGINT shutdown, retry on errors
  • Observable   — tqdm progress bar, structured logging

Usage:
    source venv/bin/activate
    python fetch_contacts.py              # first run (or resume)
    python fetch_contacts.py --export     # just convert progress → CSV
    python fetch_contacts.py --reset      # wipe progress and start fresh
"""

import os
import csv
import sys
import json
import time
import signal
import random
import logging
import argparse

from tqdm import tqdm
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

# ── Configuration ────────────────────────────────────────────────────────────

OUTPUT_CSV       = "contacts.csv"
PROGRESS_FILE    = "progress.jsonl"
MAX_CONTACTS     = None                   # None = scrape all
DIRECTORY_URL    = "https://contacts.google.com/u/0/directory"

# Timing (randomized to look human-like)
SCROLL_DELAY_MIN = 0.8                    # seconds min between scrolls
SCROLL_DELAY_MAX = 1.5                    # seconds max between scrolls
STALE_LIMIT      = 50                     # stop after N dry scrolls

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("scraper")

# ── Graceful Shutdown ────────────────────────────────────────────────────────

_shutdown_requested = False

def _handle_sigint(sig, frame):
    global _shutdown_requested
    if _shutdown_requested:
        log.warning("Force quit.")
        sys.exit(1)
    _shutdown_requested = True
    log.info("Shutdown requested (Ctrl+C). Finishing current batch…")

signal.signal(signal.SIGINT, _handle_sigint)

# ── Progress Store (JSONL) ───────────────────────────────────────────────────

def load_progress() -> dict[str, dict]:
    contacts = {}
    if not os.path.exists(PROGRESS_FILE):
        return contacts
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                c = json.loads(line)
                email = c.get("email", "")
                if email:
                    contacts[email] = c
            except json.JSONDecodeError:
                log.warning(f"Corrupt line {line_no} in {PROGRESS_FILE}, skipping.")
    return contacts


def append_contacts(contacts: list[dict]):
    with open(PROGRESS_FILE, "a", encoding="utf-8") as f:
        for c in contacts:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")


def export_csv(contacts: dict[str, dict]):
    rows = sorted(contacts.values(), key=lambda c: c.get("name", "").lower())
    fieldnames = ["Name", "Email", "Phone", "Photo URL"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in rows:
            writer.writerow({
                "Name":      c.get("name", ""),
                "Email":     c.get("email", ""),
                "Phone":     c.get("phone", ""),
                "Photo URL": c.get("photo", ""),
            })
    log.info(f"Exported {len(rows)} contacts → '{OUTPUT_CSV}'")

# ── Browser Setup ────────────────────────────────────────────────────────────

def setup_driver():
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    # Persist login session across runs (log in once, reuse forever)
    user_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_data")
    options.add_argument(f"--user-data-dir={user_data}")
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def wait_for_directory(driver, manual=False):
    if manual:
        log.info("Chrome opened. Navigate to the directory page yourself.")
        input("\n>>> Press Enter when you're on the directory page and contacts are visible...\n")
    else:
        # Go to main contacts page first (more natural than hitting /directory directly)
        log.info("Opening Google Contacts…")
        driver.get("https://contacts.google.com")
        log.info("Log in with your IITJ account if prompted.")
        log.info("Waiting for Contacts page to load…")
        WebDriverWait(driver, 120).until(
            lambda d: d.current_url is not None and "contacts.google.com" in d.current_url
        )
        time.sleep(3)

        # Click the "Directory" link in the sidebar
        log.info("Clicking 'Directory' in sidebar…")
        try:
            dir_link = WebDriverWait(driver, 30).until(
                lambda d: d.find_element(By.XPATH,
                    "//a[contains(@href, 'directory')] | //span[text()='Directory']/ancestor::a")
            )
            dir_link.click()
        except Exception:
            # Fallback: navigate directly
            log.warning("Could not find Directory link. Navigating directly…")
            driver.get(DIRECTORY_URL)

        log.info("Waiting for directory to load…")
        WebDriverWait(driver, 60).until(
            lambda d: d.current_url is not None and "directory" in d.current_url and
                d.find_elements(By.CSS_SELECTOR, '.zYQnTe')
        )

    log.info("Directory loaded.")
    time.sleep(3)
    try:
        count_el = driver.find_element(By.CSS_SELECTOR, '.LY2gHf')
        count_text = count_el.text.strip().replace("(", "").replace(")", "").replace(",", "")
        total = int(count_text)
        log.info(f"Directory reports {total:,} contacts.")
        return total
    except Exception:
        log.warning("Could not read total contact count.")
        return None

# ── Scraping Logic ───────────────────────────────────────────────────────────
#
# Key insight from yogeshs9/GoogleContactsDirectoryScraper:
# Use scrollIntoView() on the LAST visible contact element.
# This forces Google to lazy-load the data for elements near the bottom.
# Then extract contacts from all visible elements.
#
# We detect contact rows via our proven column-alignment approach,
# but scroll using scrollIntoView on the last row element.

# Step 1: Find the last contact row element and scroll it into view
SCROLL_INTO_VIEW_JS = """
    // Find the scrollable container
    var containers = document.querySelectorAll('.My2mLb');
    var scroller = null;
    for (var i = 0; i < containers.length; i++) {
        if (containers[i].scrollHeight > 100) { scroller = containers[i]; break; }
    }
    if (!scroller) return JSON.stringify({scrolled: false, atEnd: false});

    // Find all elements that look like contact row wrappers
    // These are the divs with data-index or aria attributes inside the scroll container
    var emailEls = [];
    var spans = scroller.querySelectorAll('span');
    for (var j = 0; j < spans.length; j++) {
        var t = (spans[j].textContent || '').trim();
        if (t.indexOf('@') >= 0 && t.indexOf('.') >= 0 && t.length < 80 && spans[j].offsetHeight > 0) {
            emailEls.push(spans[j]);
        }
    }

    // Scroll the LAST visible email element into view
    if (emailEls.length > 0) {
        var lastEl = emailEls[emailEls.length - 1];
        // Walk up to find the row container
        var row = lastEl;
        for (var k = 0; k < 8; k++) {
            if (row.parentElement) row = row.parentElement;
        }
        row.scrollIntoView({behavior: 'smooth', block: 'end'});
    }

    var atEnd = (scroller.scrollHeight - scroller.scrollTop) <= scroller.clientHeight + 200;
    var pct = Math.round((scroller.scrollTop / Math.max(scroller.scrollHeight - scroller.clientHeight, 1)) * 100);
    return JSON.stringify({scrolled: emailEls.length > 0, atEnd: atEnd, pct: pct, emailCount: emailEls.length});
"""

# Step 2: Extract visible contacts using confirmed current class selectors.
# zYQnTe = contact row, AYDrSb = name div, W7Nbnf = email/phone, UP1xnb = photo img.
SCRAPE_VISIBLE_JS = """
    var rows = document.querySelectorAll('.zYQnTe');
    if (rows.length === 0) return JSON.stringify([]);

    var contacts = [];
    var seenEmails = {};

    for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var rect = row.getBoundingClientRect();
        if (rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight + 50) continue;

        // Name from AYDrSb class (first one in the row is the name)
        var nameEl = row.querySelector('.AYDrSb');
        var name = nameEl ? nameEl.textContent.trim() : '';

        // Email and phone share class W7Nbnf — distinguish by @ symbol
        var email = '';
        var phone = '';
        var fields = row.querySelectorAll('.W7Nbnf');
        for (var f = 0; f < fields.length; f++) {
            var ft = (fields[f].textContent || '').trim();
            if (!ft) continue;
            if (ft.indexOf('@') >= 0 && !email) {
                email = ft;
            } else if (/^[0-9 +()-]+$/.test(ft) && !phone) {
                phone = ft;
            }
        }

        if (!email || seenEmails[email]) continue;
        seenEmails[email] = true;

        // Photo from UP1xnb class img
        var photoEl = row.querySelector('img.UP1xnb');
        var photo = photoEl ? photoEl.src || '' : '';

        contacts.push({name: name, email: email, phone: phone, photo: photo});
    }
    return JSON.stringify(contacts);
"""


def scrape_loop(driver, existing, total_estimate):
    global _shutdown_requested

    seen = set(existing.keys())
    target = MAX_CONTACTS or total_estimate or 15000
    stale_count = 0
    resuming = len(existing) > 0
    batch_buffer = []

    pbar = tqdm(
        initial=len(seen),
        total=target,
        desc="Scraping",
        unit=" contacts",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
    )

    if resuming:
        log.info(f"Resuming — scrolling through {len(seen)} saved contacts (dedup will skip them).")

    while not _shutdown_requested:
        # Step 1: Extract visible contacts
        try:
            result = driver.execute_script(SCRAPE_VISIBLE_JS)
        except Exception as e:
            log.warning(f"Scrape JS error: {e}. Retrying in 2s…")
            time.sleep(2)
            stale_count += 1
            if stale_count >= STALE_LIMIT:
                break
            continue

        contacts = []
        if result:
            try:
                contacts = json.loads(result)
            except json.JSONDecodeError:
                pass

        # Process new contacts
        new_in_batch = []
        for c in contacts:
            email = c.get("email", "")
            if email and email not in seen:
                seen.add(email)
                new_in_batch.append(c)

        if new_in_batch:
            batch_buffer.extend(new_in_batch)
            pbar.update(len(new_in_batch))
            stale_count = 0

            if resuming:
                resuming = False
                log.info("Resume catch-up complete — scraping new contacts.")

            if len(batch_buffer) >= 20:
                append_contacts(batch_buffer)
                batch_buffer.clear()
        else:
            if not resuming:
                stale_count += 1

        # Check limits
        if MAX_CONTACTS and len(seen) >= MAX_CONTACTS:
            log.info(f"Reached MAX_CONTACTS ({MAX_CONTACTS}).")
            break

        if stale_count >= STALE_LIMIT:
            log.info(f"No new contacts after {STALE_LIMIT} scrolls. Stopping.")
            break

        # Step 2: Scroll the last element into view
        try:
            scroll_result = driver.execute_script(SCROLL_INTO_VIEW_JS)
            if scroll_result:
                scroll_data = json.loads(scroll_result)
                pct = scroll_data.get("pct", 0)

                if resuming:
                    pbar.set_description(f"Catching up ({pct}%)")
                else:
                    pbar.set_description(f"Scraping ({pct}%)")

                if scroll_data.get("atEnd", False) and not resuming:
                    log.info("Reached end of directory.")
                    break
        except Exception as e:
            log.warning(f"Scroll JS error: {e}")

        # Random delay to look human
        delay = random.uniform(SCROLL_DELAY_MIN, SCROLL_DELAY_MAX)
        time.sleep(delay)

    # Flush remaining
    if batch_buffer:
        append_contacts(batch_buffer)

    pbar.close()
    return len(seen) - len(existing)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="IITJ Google Directory Scraper")
    parser.add_argument("--export", action="store_true",
                        help="Export progress.jsonl → contacts.csv without scraping")
    parser.add_argument("--reset", action="store_true",
                        help="Delete progress and start fresh")
    parser.add_argument("--wait", action="store_true",
                        help="Don't auto-navigate; wait for you to be on the directory page")
    args = parser.parse_args()

    if args.reset:
        for f in [PROGRESS_FILE, OUTPUT_CSV]:
            if os.path.exists(f):
                os.remove(f)
                log.info(f"Deleted {f}")
        log.info("Progress reset.")
        return

    if args.export:
        contacts = load_progress()
        if not contacts:
            log.error(f"No progress found ({PROGRESS_FILE}).")
            return
        export_csv(contacts)
        return

    log.info("=" * 55)
    log.info("  IITJ Google Directory Scraper — Production Pipeline")
    log.info("=" * 55)

    existing = load_progress()
    if existing:
        log.info(f"Loaded {len(existing):,} contacts from previous run.")
    else:
        log.info("Starting fresh.")

    driver = setup_driver()

    try:
        total = wait_for_directory(driver, manual=args.wait)
        start_time = time.time()
        new_count = scrape_loop(driver, existing, total)
        elapsed = time.time() - start_time
        log.info(f"Scraped {new_count:,} new contacts in {elapsed:.0f}s "
                 f"({new_count / max(elapsed, 1):.1f} contacts/sec)")
    except Exception as e:
        log.error(f"Fatal error: {e}", exc_info=True)
    finally:
        try:
            driver.quit()
        except Exception:
            pass
        log.info("Browser closed.")

    all_contacts = load_progress()
    if all_contacts:
        export_csv(all_contacts)
        log.info(f"Total: {len(all_contacts):,} contacts")
    else:
        log.warning("No contacts scraped.")

    if _shutdown_requested:
        log.info("Run again to resume.")


if __name__ == "__main__":
    main()
