"""Downloads fonts (Cairo for Arabic + Latin, Inter for Latin) into ./fonts."""
import os
import urllib.request

FONTS = {
    "Cairo.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf",
    "Inter.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
}


def main():
    os.makedirs("fonts", exist_ok=True)
    for name, url in FONTS.items():
        dest = os.path.join("fonts", name)
        if os.path.exists(dest):
            print(f"fonts/{name} already present")
            continue
        print(f"downloading {name} …")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"  saved fonts/{name}")
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED: {e} — the service will fall back to system fonts")


if __name__ == "__main__":
    main()
