"""Agrega testers por email al grupo externo "Equipo de campo". Apple les manda la invitación de TestFlight."""
import os
import re
import time

import jwt
import requests

APP_ID = "6839228341"
GROUP_NAME = "Equipo de campo"
TESTERS = [
    ("Inés", "Rimonim", "ines@rimonim.com.ar"),
    ("Joaquín", "Rimonim", "joaquin@rimonim.com.ar"),
    ("Wainer", "Rimonim", "wainer@rimonim.com.ar"),
]

raw = os.environ["ASC_KEY_P8"].replace("\r", "")
body = re.sub(r"[^A-Za-z0-9+/=]", "", re.sub(r"-----(BEGIN|END)[A-Z ]*-----", "", raw))
key = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(body[i:i + 64] for i in range(0, len(body), 64)) + "\n-----END PRIVATE KEY-----\n"
token = jwt.encode(
    {"iss": os.environ["ASC_ISSUER_ID"], "iat": int(time.time()), "exp": int(time.time()) + 600, "aud": "appstoreconnect-v1"},
    key, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"]})
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
API = "https://api.appstoreconnect.apple.com/v1"

groups = requests.get(f"{API}/apps/{APP_ID}/betaGroups", headers=H, timeout=30).json()["data"]
group = next(g for g in groups if g["attributes"]["name"] == GROUP_NAME)
gid = group["id"]
print("Grupo:", GROUP_NAME, gid)

for first, last, email in TESTERS:
    payload = {"data": {"type": "betaTesters",
                        "attributes": {"firstName": first, "lastName": last, "email": email},
                        "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": gid}]}}}}
    r = requests.post(f"{API}/betaTesters", headers=H, json=payload, timeout=30)
    if r.status_code in (200, 201):
        print(f"OK agregado: {email}")
    elif r.status_code == 409:
        # Ya existe como tester: lo vinculamos al grupo
        found = requests.get(f"{API}/betaTesters", headers=H, params={"filter[email]": email}, timeout=30).json()["data"]
        if found:
            tid = found[0]["id"]
            r2 = requests.post(f"{API}/betaGroups/{gid}/relationships/betaTesters", headers=H,
                               json={"data": [{"type": "betaTesters", "id": tid}]}, timeout=30)
            print(f"Ya existía {email}; vínculo al grupo: {r2.status_code}")
        else:
            print(f"409 sin tester encontrado para {email}: {r.text[:300]}")
    else:
        print(f"ERROR {email}: {r.status_code} {r.text[:400]}")

print("== Testers del grupo ==")
for t in requests.get(f"{API}/betaGroups/{gid}/betaTesters", headers=H, timeout=30).json()["data"]:
    a = t["attributes"]
    print(f" - {a.get('email')} | {a.get('state')} | invitación={a.get('inviteType')}")
