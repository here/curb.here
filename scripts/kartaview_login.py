#!/usr/bin/env python3
"""One-time KartaView login via OSM OAuth 2.0 (public client + PKCE, out-of-band code).

Setup (once):
  1. Register an OAuth 2 app at https://www.openstreetmap.org/oauth2/applications
       - Confidential application: UNCHECKED
       - Redirect URI:            urn:ietf:wg:oauth:2.0:oob
       - Permissions:             Read user preferences (read_prefs)
  2. Put the client ID in .env:  OSM_CLIENT_ID="..."

Run:  python3 -I scripts/kartaview_login.py                 (interactive)
  or: python3 -I scripts/kartaview_login.py --url           (step 1: print URL, save PKCE state)
      python3 -I scripts/kartaview_login.py --code <CODE>   (step 2: finish with the pasted code)
  - opens/prints an OSM authorize URL; approve it in any browser
  - paste the code shown by OSM back here
  - the script exchanges it for an OSM token, then for a KartaView token,
    and saves KARTAVIEW_ACCESS_TOKEN to .env (tokens are never printed).
"""
import base64, hashlib, json, os, re, secrets, sys, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / ".env"
OSM = "https://www.openstreetmap.org"
KV_API = "https://api.kartaview.org"   # api.openstreetcam.org times out as of 2026-11-27
REDIRECT = "urn:ietf:wg:oauth:2.0:oob"
SCOPE = "read_prefs"
STATE_FILE = ENV.parent / ".kartaview_login_state"   # gitignored; holds the PKCE verifier between steps


def load_env():
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def save_env(key, value):
    lines = ENV.read_text().splitlines() if ENV.exists() else []
    entry = f'{key}="{value}"'
    for i, line in enumerate(lines):
        if re.match(rf"^{re.escape(key)}=", line):
            lines[i] = entry
            break
    else:
        lines += ["", "# KartaView (from scripts/kartaview_login.py)", entry]
    old = os.umask(0o077)
    try:
        ENV.write_text("\n".join(lines) + "\n")
    finally:
        os.umask(old)
    os.chmod(ENV, 0o600)


def post(url, data, headers=None):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode(), headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def main():
    load_env()
    client_id = os.environ.get("OSM_CLIENT_ID") or sys.exit("Set OSM_CLIENT_ID in .env first (see docstring).")

    args = sys.argv[1:]
    if args[:1] == ["--code"]:
        if len(args) < 2 or not STATE_FILE.exists():
            sys.exit("Run with --url first, then --code <CODE>.")
        verifier = STATE_FILE.read_text().strip()
        return finish(client_id, verifier, args[1].strip())

    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    url = f"{OSM}/oauth2/authorize?" + urllib.parse.urlencode({
        "response_type": "code", "client_id": client_id, "redirect_uri": REDIRECT,
        "scope": SCOPE, "code_challenge": challenge, "code_challenge_method": "S256", "state": state,
    })
    print("1. Open this URL in a browser and approve:\n\n   " + url + "\n")
    if args[:1] == ["--url"]:
        old = os.umask(0o077)
        try:
            STATE_FILE.write_text(verifier)
        finally:
            os.umask(old)
        print("2. Then run:  python3 -I scripts/kartaview_login.py --code <CODE>")
        return
    code = input("2. Paste the authorization code shown by OSM: ").strip()
    if not code:
        sys.exit("No code entered.")
    finish(client_id, verifier, code)


def finish(client_id, verifier, code):
    status, body = post(f"{OSM}/oauth2/token", {
        "grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT,
        "client_id": client_id, "code_verifier": verifier,
    })
    if status != 200:
        sys.exit(f"OSM token exchange failed (HTTP {status}): {body[:300]}")
    osm_token = json.loads(body)["access_token"]
    print("   OSM token: ok")

    status, body = post(f"{KV_API}/auth/openstreetmap/client_auth",
                        {"request_token": osm_token, "secret_token": "undefined"})
    if status != 200:
        sys.exit(f"KartaView client_auth failed (HTTP {status}): {body[:300]}")
    try:
        data = json.loads(body)
        kv_token = (data.get("osv") or data).get("access_token") or data.get("result", {}).get("access_token")
    except (ValueError, AttributeError):
        kv_token = None
    if not kv_token:
        sys.exit(f"Unexpected client_auth response shape (keys only): {list(json.loads(body)) if body.startswith('{') else body[:100]}")
    save_env("KARTAVIEW_ACCESS_TOKEN", kv_token)
    STATE_FILE.unlink(missing_ok=True)
    print(f"   KartaView token: saved to {ENV} as KARTAVIEW_ACCESS_TOKEN")

    # Which auth header does the API accept? (docs disagree)
    for hdr in ("Access-Token", "X-Auth-Token"):
        req = urllib.request.Request(f"{KV_API}/2.0/user/profile", headers={hdr: kv_token})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print(f"   /2.0/user/profile with {hdr}: HTTP {r.status}")
        except urllib.error.HTTPError as e:
            print(f"   /2.0/user/profile with {hdr}: HTTP {e.code}")


if __name__ == "__main__":
    main()
