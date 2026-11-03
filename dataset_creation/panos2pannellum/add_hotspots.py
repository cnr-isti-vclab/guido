import json
import os
import argparse


def add_photos_to_json(json_path, images_folder, set_name="default"):
    # Load existing JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Supported image extensions
    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}

    photos = data.get("photos", [])
    existing_names = set()
    existing_ids = {
        photo["id"]
        for photo in photos
        if isinstance(photo, dict) and "id" in photo
    }

    for photo in photos:
        if not isinstance(photo, dict):
            continue
        if photo.get("tooltip"):
            existing_names.add(str(photo["tooltip"]).casefold())
        if photo.get("url"):
            existing_names.add(
                os.path.splitext(os.path.basename(photo["url"]))[0].casefold()
            )

    added_count = 0

    # Sort files for deterministic IDs
    for filename in sorted(os.listdir(images_folder)):
        filepath = os.path.join(images_folder, filename)

        if not os.path.isfile(filepath):
            continue

        ext = os.path.splitext(filename)[1].lower()
        if ext not in image_extensions:
            continue

        name = os.path.splitext(filename)[0]
        if name.casefold() in existing_names:
            continue

        photo_id = len(photos)
        while photo_id in existing_ids:
            photo_id += 1

        photos.append({
            "tooltip": name,
            "url": os.path.relpath(
                filepath,
                start=os.path.dirname(os.path.abspath(json_path))
            ).replace("\\", "/"),
            "set": set_name,
            "visiblefrom": [],
            "id": photo_id
        })

        existing_names.add(name.casefold())
        existing_ids.add(photo_id)
        added_count += 1

    # Add the new photos while preserving existing entries
    data["photos"] = photos

    # Write the updated data back to the input JSON file
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Added {added_count} photos to '{json_path}'")


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
    