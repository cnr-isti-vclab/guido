#! python3
import subprocess
import json
import re
import os
import argparse
import json
import jsbeautifier

import PIL.Image
import PIL.ExifTags

try:
    import numpy as mathlib
    use_numpy = True
except ImportError:
    import math as mathlib
    use_numpy = False

def rotate_matrix(angle_deg, axis):
    angle = mathlib.deg2rad(angle_deg)
    axis = mathlib.asarray(axis, dtype=float)
    axis = axis / mathlib.linalg.norm(axis)

    x, y, z = axis
    c = mathlib.cos(angle)
    s = mathlib.sin(angle)
    C = 1 - c

    R = mathlib.array([
        [c + x*x*C,     x*y*C - z*s, x*z*C + y*s],
        [y*x*C + z*s,   c + y*y*C,   y*z*C - x*s],
        [z*x*C - y*s,   z*y*C + x*s, c + z*z*C]
    ])

    return R


def dms_to_decimal(degrees, minutes, seconds, direction):
    """
    Convert degrees, minutes, seconds to decimal degrees.
    The direction is 'N', 'S', 'E', or 'W' and affects the sign.
    """
    decimal = degrees + (minutes / 60) + (seconds / 3600)
    if direction in ['S', 'W']:
        decimal = -decimal
    return decimal

def parse_dms_string(dms_string):
    """
    Parse a DMS string (e.g., '43 deg 43\' 21.94" N') into degrees, minutes, seconds, and direction.
    """
    # Regex pattern to extract degrees, minutes, seconds, and direction
    pattern = re.compile(r'(\d+)\s*deg\s*(\d+)\s*\'\s*(\d+\.?\d*)"\s*([NSWE])')
    match = pattern.match(dms_string)
    
    if match:
        degrees = float(match.group(1))
        minutes = float(match.group(2))
        seconds = float(match.group(3))
        direction = match.group(4)
        return degrees, minutes, seconds, direction
    else:
        raise ValueError(f"Invalid DMS format: {dms_string}")

def print_exif_metadata(file_path):
    try:
        # Run exiftool to extract EXIF metadata in JSON format
        result = subprocess.run(
            ['exiftool', '-json', file_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode != 0:
            print(f"Error running exiftool for EXIF metadata: {result.stderr}")
            return
        
        # Parse the JSON output
        exif_metadata = json.loads(result.stdout)
        
        if exif_metadata:
            # Extract specific fields
            metadata = exif_metadata[0]  # Assume a list with one dictionary
            
            # Extract and print PoseHeadingDegrees
            pose_heading = metadata.get('PoseHeadingDegrees')
            if pose_heading is not None:
                print(f"PoseHeadingDegrees: {pose_heading}")
            else:
                print("PoseHeadingDegrees not found.")
            
            # Extract GPSLatitude and GPSLongitude
            gps_latitude = metadata.get('GPSLatitude')
            gps_longitude = metadata.get('GPSLongitude')
            gps_latitude_ref = metadata.get('GPSLatitudeRef', 'N')
            gps_longitude_ref = metadata.get('GPSLongitudeRef', 'E')
            
            if gps_latitude and gps_longitude:
                try:
                    # Parse latitude
                    lat_degrees, lat_minutes, lat_seconds, lat_ref = parse_dms_string(gps_latitude)
                    decimal_latitude = dms_to_decimal(lat_degrees, lat_minutes, lat_seconds, lat_ref)
                    
                    # Parse longitude
                    lon_degrees, lon_minutes, lon_seconds, lon_ref = parse_dms_string(gps_longitude)
                    decimal_longitude = dms_to_decimal(lon_degrees, lon_minutes, lon_seconds, lon_ref)
                    
                    # Print the converted values
                    print(f"GPSLatitude: {decimal_latitude:.6f}")
                    print(f"GPSLongitude: {decimal_longitude:.6f}")
                except ValueError as e:
                    print(f"Error parsing DMS values: {e}")
            else:
                print("GPSLatitude or GPSLongitude not found.")
        else:
            print("No EXIF metadata found.")
    
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON for EXIF metadata: {e}")
    except Exception as e:
        print(f"An error occurred while extracting EXIF metadata: {e}")

    return decimal_latitude, decimal_longitude,0, pose_heading


# 
def cl_parser():
    parser = argparse.ArgumentParser(description='Crea un dataset da file con informazioni EXIF.')

    parser.add_argument('--input_folder', type=str,
                        help='Name of the input folder containing the images. Default: current folder', default='.')
    
    parser.add_argument('-o', '--output_file', type=str, default='dataset',
                        help='Name of the output JSON file. Default: dataset')

    args = parser.parse_args()

    print(f"Running '{os.path.basename(__file__)}'")

    return args.input_folder, args.output_file

# Recupero dei dati EXIF
def get_exif_gps(image_file_path):

    GPSLatitude, GPSLongitude, GPSAltitude, GPSDirection = print_exif_metadata(image_file_path);

    gps_info = {
        "latitude": GPSLatitude,
        "longitude": GPSLongitude,
        "altitude": GPSAltitude,
        "direction": GPSDirection  
    }

    return gps_info

# Conversione da DMS a DD
def dms_to_dd(dms, dms_ref):
    m = float(dms[1])/60
    s = float(dms[2])/3600
  
    dd = float(dms[0]) + m + s

    if dms_ref == 'S' or dms_ref == 'W':
        dd = -dd
    
    return dd

# Calcolo del bounding box in latitudine e longitudine
def calculate_latlon_bb(gps_pos, bb_latlon, bb_latlon_first):
    if bb_latlon_first:
        bb_latlon["latitude_max"] = gps_pos["latitude"]
        bb_latlon["latitude_min"] = gps_pos["latitude"]
        bb_latlon["longitude_max"] = gps_pos["longitude"]
        bb_latlon["longitude_min"] = gps_pos["longitude"]
        bb_latlon["altitude_max"] = gps_pos["altitude"]
        bb_latlon["altitude_min"] = gps_pos["altitude"]
    else:
        if gps_pos["latitude"] > bb_latlon["latitude_max"]: 
            bb_latlon["latitude_max"] = gps_pos["latitude"]
        if gps_pos["latitude"] < bb_latlon["latitude_min"]: 
            bb_latlon["latitude_min"] = gps_pos["latitude"]
        if gps_pos["longitude"] > bb_latlon["longitude_max"]: 
            bb_latlon["longitude_max"] = gps_pos["longitude"]
        if gps_pos["longitude"] < bb_latlon["longitude_min"]: 
            bb_latlon["longitude_min"] = gps_pos["longitude"]
        if gps_pos["altitude"] > bb_latlon["altitude_max"]: 
            bb_latlon["altitude_max"] = gps_pos["altitude"]
        if gps_pos["altitude"] < bb_latlon["altitude_min"]: 
            bb_latlon["altitude_min"] = gps_pos["altitude"]

# Calcolo del bounding box in proiezione
# coord tuple float (easting, northing)
def calculate_proj_bb(coord, bb, bb_first):
    if bb_first:
        bb["easting_min"] = coord[0]
        bb["northing_min"] = coord[1]
        bb["easting_max"] = coord[0]
        bb["northing_max"] = coord[1]
    else:
        if coord[0] < bb["easting_min"]:
            bb["easting_min"] = coord[0]
        elif coord[0] > bb["easting_max"]:
            bb["easting_max"] = coord[0]
        if coord[1] < bb["northing_min"]:
            bb["northing_min"] = coord[1]
        elif coord[1] > bb["northing_max"]:
            bb["northing_max"] = coord[1]

# Proiezione tipo UTM ma con meridiano centrale arbitrario
K0 = 0.9996

E = 0.00669438
E2 = E * E
E3 = E2 * E
E_P2 = E / (1 - E)

SQRT_E = mathlib.sqrt(1 - E)
_E = (1 - SQRT_E) / (1 + SQRT_E)
_E2 = _E * _E
_E3 = _E2 * _E
_E4 = _E3 * _E
_E5 = _E4 * _E

M1 = (1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256)
M2 = (3 * E / 8 + 3 * E2 / 32 + 45 * E3 / 1024)
M3 = (15 * E2 / 256 + 45 * E3 / 1024)
M4 = (35 * E3 / 3072)

R = 6378137

class OutOfRangeError(ValueError):
    pass

def in_bounds(x, lower, upper, upper_strict=False):
    if upper_strict and use_numpy:
        return lower <= mathlib.min(x) and mathlib.max(x) < upper
    elif upper_strict and not use_numpy:
        return lower <= x < upper
    elif use_numpy:
        return lower <= mathlib.min(x) and mathlib.max(x) <= upper
    return lower <= x <= upper

def mixed_signs(x):
    return use_numpy and mathlib.min(x) < 0 and mathlib.max(x) >= 0

def negative(x):
    if use_numpy:
        return mathlib.max(x) < 0
    return x < 0

def mod_angle(value):
    """Returns angle in radians to be between -pi and pi"""
    return (value + mathlib.pi) % (2 * mathlib.pi) - mathlib.pi

def coord_projection(latitude, longitude, central_meridian):
    """This function converts Latitude and Longitude to UTM coordinate

        Parameters
        ----------
        latitude: float or NumPy array
            Latitude between 80 deg S and 84 deg N, e.g. (-80.0 to 84.0)

        longitude: float or NumPy array
            Longitude between 180 deg W and 180 deg E, e.g. (-180.0 to 180.0).

        central_lon: float or NumPy array
            Longitude of the central meridian of the zone being converted.

        Returns
        -------
        easting: float or NumPy array
            Easting value of UTM coordinates

        northing: float or NumPy array
            Northing value of UTM coordinates


       .. _[1]: http://www.jaworski.ca/utmzones.htm
    """
    if not in_bounds(latitude, -80, 84):
        raise OutOfRangeError('latitude out of range (must be between 80 deg S and 84 deg N)')
    if not in_bounds(longitude, -180, 180):
        raise OutOfRangeError('longitude out of range (must be between 180 deg W and 180 deg E)')

    lat_rad = mathlib.radians(latitude)
    lat_sin = mathlib.sin(lat_rad)
    lat_cos = mathlib.cos(lat_rad)

    lat_tan = lat_sin / lat_cos
    lat_tan2 = lat_tan * lat_tan
    lat_tan4 = lat_tan2 * lat_tan2

    lon_rad = mathlib.radians(longitude)
    central_lon = central_meridian
    central_lon_rad = mathlib.radians(central_lon)

    n = R / mathlib.sqrt(1 - E * lat_sin**2)
    c = E_P2 * lat_cos**2

    a = lat_cos * mod_angle(lon_rad - central_lon_rad)
    a2 = a * a
    a3 = a2 * a
    a4 = a3 * a
    a5 = a4 * a
    a6 = a5 * a

    m = R * (M1 * lat_rad -
             M2 * mathlib.sin(2 * lat_rad) +
             M3 * mathlib.sin(4 * lat_rad) -
             M4 * mathlib.sin(6 * lat_rad))

    easting = K0 * n * (a +
                        a3 / 6 * (1 - lat_tan2 + c) +
                        a5 / 120 * (5 - 18 * lat_tan2 + lat_tan4 + 72 * c - 58 * E_P2)) + 500000

    northing = K0 * (m + n * lat_tan * (a2 / 2 +
                                        a4 / 24 * (5 - lat_tan2 + 9 * c + 4 * c**2) +
                                        a6 / 720 * (61 - 58 * lat_tan2 + lat_tan4 + 600 * c - 330 * E_P2)))

    if mixed_signs(latitude):
        raise ValueError("latitudes must all have the same sign")
    elif negative(latitude):
        northing += 10000000

    return easting, northing

if __name__ == "__main__":
    # Parsing dei parametri da linea di comando
    folder, output = cl_parser()

    pano_id = 0
    tour_id = 0
    set_id = 0

    # Dataset
    dataset = {
    "name": "Pisa",
    "sets": [],
    "accessPoints": []
    }
            
    set_central_meridian = 0

    for set in sorted(os.listdir(folder)): 
        set_path = os.path.join(folder, set)
        print (set_path)
        if os.path.isdir(set_path):   

            set_entry = {
                "id": set_id,
                "name": set,
                "order": set_id,
                "panos": [],
                "boundingbox_latlon": {
                    "latitude_max": 0,
                    "latitude_min": 0,
                    "longitude_max": 0,
                    "longitude_min": 0,
                    "altitude_max": 0,
                    "altitude_min": 0
                },
                "boundingbox": {
                    "easting_min": 0,
                    "northing_min": 0,
                    "easting_max": 0,
                    "northing_max": 0
                }
            }

            set_id += 1

            set_central_meridian = 0
            bb_latlon_first = True
            bb_first = True

            for file in sorted(os.listdir(set_path)):
                f = os.path.join(set_path, file)

                # tuple float (dd_latitude, dd_longitude, altitude)
                gps = get_exif_gps(f)
                
                #compute the rotation matrix from the PoseHeadingDegrees
                #if there is no PoseHeadingDegrees, skip the image
                if gps["direction"] is None:
                    continue

                rotation_matrix = mathlib.eye(4)
                r33  = rotate_matrix(gps["direction"], (0, 1, 0))
                rotation_matrix[:3,:3] = r33
                

                pano = {
                    "id": pano_id,
                    "url": set + "/" + file,
                    "label": set + " " + str(pano_id),
                    "priority": 2,
                    "skip": False,
                    "skipLinks": [],
                    "rotation": rotation_matrix.flatten().tolist(),
                    "initialYaw": gps["direction"],
                    "horizontalPitch": 0,
                    "horizontalRoll": 0,
                    "links": [],
                    "latitude": gps["latitude"],
                    "longitude": gps["longitude"],
                    "altitude": gps["altitude"],
                }

                set_entry["panos"].append(pano)
                pano_id += 1

                # calcolo del bounding box in latitudine e longitudine
                calculate_latlon_bb(gps, set_entry["boundingbox_latlon"], bb_latlon_first)

                if bb_latlon_first:
                    bb_latlon_first = False

                # controllo se il bounding box è troppo grande
                if (set_entry["boundingbox_latlon"]["longitude_max"]-set_entry["boundingbox_latlon"]["longitude_min"] > 6) :
                    raise ValueError(f"Area {set_entry['name']} is too big")
            
            # Calcolo il meridiano centrale della zona di proiezione
            set_central_meridian = int((set_entry["boundingbox_latlon"]["longitude_max"] + set_entry["boundingbox_latlon"]["longitude_min"]) / 2)

            # Iterazione sugli elementi del set_entry per calcolare le coordinate rispetto la proiezione scelta e il relativo bounding box
            
            for id,pano in enumerate(set_entry["panos"]):
                # Calcolo della proiezione
                coord = coord_projection(pano["latitude"], pano["longitude"], set_central_meridian)

                # Inserimento delle coordinate nel set_entry
                pano["easting"] = coord[0]
                pano["northing"] = coord[1]

                # Calcolo del bounding box
                calculate_proj_bb(coord, set_entry["boundingbox"], bb_first)

                if bb_first:
                    bb_first = False

                for idn in range(len(set_entry["panos"])):
                    if idn != id:
                        set_entry["panos"][id]["links"].append(idn)

            # Iterazione sugli elementi del set_entry per calcolare la traslazione rispetto al vertice in basso a sinistra del bounding box
            for pano in set_entry["panos"]:
                pano["translation"] = [
                    (pano["easting"] - set_entry["boundingbox"]["easting_min"]),
                    2.2,
                    (pano["northing"] - set_entry["boundingbox"]["northing_min"])
                    ]
                
                pano.pop("easting")
                pano.pop("northing")

            dataset["sets"].append(set_entry)
            dataset["accessPoints"].append(0)

    set_id = 0

    # Converto il dictionary in una stringa JSON
    json_string = json.dumps(dataset)

    # Uso jsbeautifier per formattare la stringa JSON
    formatted_json = jsbeautifier.beautify(json_string)

    # Scrivo la stringa JSON formattata nel file
    with open(f'{output}', 'w') as json_file:
        json_file.write(formatted_json)

# https://exiv2.org/tags.html
# https://pillow.readthedocs.io/en/stable/_modules/PIL/ExifTags.html#GPS
