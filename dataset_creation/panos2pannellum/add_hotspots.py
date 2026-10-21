import json
import os
import argparse


def add_photos_to_json(json_path, images_folder, set_name="default"):
    # Load existing JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Supported image extensions
    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

    photos = []
    photo_id = 0

    # Sort files for deterministic IDs
    for filename in sorted(os.listdir(images_folder)):
        filepath = os.path.join(images_folder, filename)

        if not os.path.isfile(filepath):
            continue

        ext = os.path.splitext(filename)[1].lower()
        if ext not in image_extensions:
            continue

        name = os.path.splitext(filename)[0]

        photos.append({
            "tooltip": name,
            "url": filepath.replace("\\", "/"),
            "set": set_name,
            "visiblefrom": [],
            "id": photo_id
        })

        photo_id += 1

    # Add or replace photos array at root level
    data["photos"] = photos

    # Write back JSON
    with open("new_dataset.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Added {len(photos)} photos to '{json_path}'")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path", help="Path to JSON file")
    parser.add_argument("images_folder", help="Path to folder containing images")
    parser.add_argument(
        "--set",
        dest="set_name",
        default="default",
        help="Value for the 'set' field"
    )

    args = parser.parse_args()

    add_photos_to_json(
        args.json_path,
        args.images_folder,
        args.set_name
    )