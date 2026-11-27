"""Imprime el estado de TestFlight de Scan Rimonim LiDAR (solo lectura)."""
import os
import re
import time

import jwt
import requests

APP_ID = "6839228341"
raw = os.environ["ASC_KEY_P8"].replace("\r", "")
body = re.sub(r"[^A-Za-z0-9+/=]", "", re.sub(r"-----(BEGIN|END)[A-Z ]*-----", "", raw))
key = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(body[i:i + 64] for i in range(0, len(body), 64)) + "\n-----END PRIVATE KEY-----\n"
token = jwt.encode(
    {"iss": os.environ["ASC_ISSUER_ID"], "iat": int(time.time()), "exp": int(time.time()) + 600, "aud": "appstoreconnect-v1"},
    key, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"]})
H = {"Authorization": f"Bearer {token}"}
API = "https://api.appstoreconnect.apple.com/v1"


def get(path, **params):
    r = requests.get(API + path, headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


print("== Builds ==")
builds = get("/builds", **{"filter[app]": APP_ID, "sort": "-uploadedDate", "limit": 5,
                          "include": "buildBetaDetail"})
detail = {d["id"]: d["attributes"] for d in builds.get("included", []) if d["type"] == "buildBetaDetails"}
for b in builds["data"]:
    a = b["attributes"]
    bd = detail.get(b["relationships"]["buildBetaDetail"]["data"]["id"], {})
    print(f"build {a['version']} | {a['processingState']} | subido {a['uploadedDate']} | "
          f"interno={bd.get('internalBuildState')} externo={bd.get('externalBuildState')}")

print("== Revisión beta ==")
for b in builds["data"][:3]:
    sub = get("/betaAppReviewSubmissions", **{"filter[build]": b["id"]})
    for s in sub["data"]:
        print(f"build {b['attributes']['version']}: {s['attributes'].get('betaReviewState')} "
              f"(enviado {s['attributes'].get('submittedDate')})")

print("== Grupos ==")
groups = get(f"/apps/{APP_ID}/betaGroups")
for g in groups["data"]:
    a = g["attributes"]
    testers = get(f"/betaGroups/{g['id']}/betaTesters", limit=50)
    print(f"{a['name']} | interno={a['isInternalGroup']} | link público={a.get('publicLinkEnabled')} "
          f"{a.get('publicLink') or ''} | límite={a.get('publicLinkLimit')} | testers={len(testers['data'])}")
    for t in testers["data"]:
        ta = t["attributes"]
        print(f"   - {ta.get('email')} | {ta.get('state')}")

print("== Info de revisión beta ==")
info = get(f"/apps/{APP_ID}/betaAppReviewDetail")["data"]["attributes"]
print({k: (v if k != "demoAccountPassword" else ("***" if v else None)) for k, v in info.items()})

print("== Usuarios e invitaciones ==")
for u in get("/userInvitations", limit=50)["data"]:
    ua = u["attributes"]
    print(f"invitación pendiente: {ua.get('email')} | roles={ua.get('roles')} | vence {ua.get('expirationDate')}")
for u in get("/users", limit=50)["data"]:
    ua = u["attributes"]
    print(f"usuario: {ua.get('username')} | roles={ua.get('roles')}")
