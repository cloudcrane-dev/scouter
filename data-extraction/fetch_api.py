"""
IITJ Google Directory — People API Fetcher
===========================================
Uses the Google People API (listDirectoryPeople) to fetch all
directory contacts. Much more reliable than Selenium scraping.

Usage:
    python fetch_api.py           # Fetch all contacts (resumes from progress)
    python fetch_api.py --reset   # Start fresh
"""

import os
import json
import csv
import argparse
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ── Config ──────────────────────────────────────────────────────────────────
SCOPES = ["https://www.googleapis.com/auth/directory.readonly"]
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token_api.json")
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "progress_api.jsonl")
OUTPUT_CSV = os.path.join(os.path.dirname(__file__), "contacts_api.csv")
PAGE_SIZE = 1000  # max allowed by API

log = logging.getLogger("iitj_api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s",
                    datefmt="%H:%M:%S")


def get_credentials():
    """Authenticate with OAuth2 (opens browser on first run)."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
        log.info("Saved credentials to %s", TOKEN_FILE)
    return creds


def load_progress():
    """Load previously fetched contacts."""
    contacts = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            for line in f:
                line = line.strip()
                if line:
                    c = json.loads(line)
                    email = c.get("email", "")
                    if email:
                        contacts[email] = c
    return contacts


def append_contacts(contacts_list):
    """Append contacts to the progress file."""
    with open(PROGRESS_FILE, "a") as f:
        for c in contacts_list:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")


def export_csv(contacts_dict):
    """Export contacts to CSV."""
    rows = list(contacts_dict.values())
    if not rows:
        return
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["Name", "Email", "Phone", "Photo URL"])
        writer.writeheader()
        for c in sorted(rows, key=lambda x: x.get("name", "")):
            writer.writerow({
                "Name": c.get("name", ""),
                "Email": c.get("email", ""),
                "Phone": c.get("phone", ""),
                "Photo URL": c.get("photo", ""),
            })
    log.info("Exported %d contacts → '%s'", len(rows), OUTPUT_CSV)


def extract_contact(person):
    """Extract contact info from a People API person resource."""
    name = ""
    names = person.get("names", [])
    if names:
        name = names[0].get("displayName", "")

    email = ""
    emails = person.get("emailAddresses", [])
    if emails:
        email = emails[0].get("value", "")

    phone = ""
    phones = person.get("phoneNumbers", [])
    if phones:
        phone = phones[0].get("value", "")

    photo = ""
    photos = person.get("photos", [])
    if photos:
        photo = photos[0].get("url", "")

    return {"name": name, "email": email, "phone": phone, "photo": photo}


def fetch_directory(service, existing):
    """Fetch all directory contacts using listDirectoryPeople."""
    page_token = None
    total_new = 0
    total_fetched = 0
    batch = []

    log.info("Fetching directory contacts via People API...")

    while True:
        try:
            result = service.people().listDirectoryPeople(
                readMask="names,emailAddresses,phoneNumbers,photos",
                sources=["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"],
                pageSize=PAGE_SIZE,
                pageToken=page_token,
            ).execute()
        except Exception as e:
            log.error("API error: %s", e)
            break

        people = result.get("people", [])
        total_fetched += len(people)

        for person in people:
            contact = extract_contact(person)
            email = contact.get("email", "")
            if email and email not in existing:
                existing[email] = contact
                batch.append(contact)
                total_new += 1

        # Save batch
        if batch:
            append_contacts(batch)
            batch.clear()

        log.info("Fetched %d contacts so far (%d new)", total_fetched, total_new)

        page_token = result.get("nextPageToken")
        if not page_token:
            log.info("No more pages — done!")
            break

    return total_new


def main():
    parser = argparse.ArgumentParser(description="IITJ Directory — People API Fetcher")
    parser.add_argument("--reset", action="store_true", help="Delete progress and start fresh")
    args = parser.parse_args()

    if args.reset:
        for f in [PROGRESS_FILE, OUTPUT_CSV]:
            if os.path.exists(f):
                os.remove(f)
                log.info("Deleted %s", os.path.basename(f))
        log.info("Progress reset.")

    existing = load_progress()
    if existing:
        log.info("Loaded %d contacts from previous run.", len(existing))

    log.info("=== Authenticating with Google ===")
    creds = get_credentials()
    service = build("people", "v1", credentials=creds)

    new_count = fetch_directory(service, existing)

    export_csv(existing)
    log.info("Total: %d contacts (%d new this run)", len(existing), new_count)


if __name__ == "__main__":
    main()
