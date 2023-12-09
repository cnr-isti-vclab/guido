#! python3
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

# 
def cl_parser():
    parser = argparse.ArgumentParser(description='Crea un dataset da file con informazioni EXIF.')

    parser.add_argument('folder', type=str,
                        help='Il nome della cartella che contiene le immagini da cui generare il dataset.')
    
    parser.add_argument('-o', '--output', type=str, default='dataset',
                        help='Nome del file JSON di output. Default: dataset')

    args = parser.parse_args()

    print(f"Running '{os.path.basename(__file__)}'")

    return args.folder, args.output

# Recupero dei dati EXIF
def get_exif_gps(image_file_path):
    img = PIL.Image.open(image_file_path)
    exif_data = img._getexif()

    from PIL.ExifTags import IFD
    exif_gps = exif_data[IFD.GPSInfo]

    from PIL.ExifTags import GPS
    gps_latitude_ref = exif_gps[GPS.GPSLatitudeRef]
    gps_latitude = exif_gps[GPS.GPSLatitude]
    gps_longitude_ref = exif_gps[GPS.GPSLongitudeRef]
    gps_longitude = exif_gps[GPS.GPSLongitude]
    gps_altitude = exif_gps[GPS.GPSAltitude]
    
    if GPS.GPSImgDirection in exif_gps:
        gps_direction = float(exif_gps[GPS.GPSImgDirection])
    else:
        gps_direction = 0

    gps_latitude_dd = dms_to_dd(gps_latitude, gps_latitude_ref)
    gps_longitude_dd = dms_to_dd(gps_longitude, gps_longitude_ref)
    gps_altitude = float(gps_altitude)

    gps_pos = (gps_latitude_dd, gps_longitude_dd, gps_altitude, gps_direction)

    return gps_pos

# Conversione da DMS a DD
def dms_to_dd(dms, dms_ref):
    m = float(dms[1])/60
    s = float(dms[2])/3600
  
    dd = float(dms[0]) + m + s

    if dms_ref == 'S' or dms_ref == 'W':
        dd = -dd
    
    return dd

# Calcolo del bounding box in latitudine e longitudine
# gps_pos tuple float (dd_latitude, dd_longitude, altitude)
# bb_latlon list float [bb_latitude_max, bb_latitude_min, bb_longitude_max, bb_longitude_min, bb_altitude_max, bb_altitude_min, validity flag]
def calculate_latlon_bb(gps_pos, bb_latlon):

    if bb_latlon[6] == 0:
        bb_latlon[0] = gps_pos[0]
        bb_latlon[1] = gps_pos[0]
        bb_latlon[2] = gps_pos[1]
        bb_latlon[3] = gps_pos[1]
        bb_latlon[4] = gps_pos[2]
        bb_latlon[5] = gps_pos[2]
        bb_latlon[6] = 1
    else:
        if gps_pos[0] > bb_latlon[0]: 
            bb_latlon[0] = gps_pos[0]
        if gps_pos[0] < bb_latlon[1]: 
            bb_latlon[1] = gps_pos[0]
        if gps_pos[1] > bb_latlon[2]: 
            bb_latlon[2] = gps_pos[1]
        if gps_pos[1] < bb_latlon[3]: 
            bb_latlon[3] = gps_pos[1]
        if gps_pos[2] > bb_latlon[4]: 
            bb_latlon[4] = gps_pos[2]
        if gps_pos[2] < bb_latlon[5]: 
            bb_latlon[5] = gps_pos[2]

# Calcolo del bounding box in proiezione
# coord tuple float (easting, northing)
# bb list float [easting_min, northing_min, easting_max, northing_max, validity flag]
def calculate_proj_bb(coord, bb):

    if bb[4] == 0:
        bb[0] = coord[0]
        bb[1] = coord[1]
        bb[2] = coord[0]
        bb[3] = coord[1]
        bb[4] = 1
    else:
        if coord[0] < bb[0]:
            bb[0] = coord[0]
        elif coord[0] > bb[2]:
            bb[2] = coord[0]
        if coord[1] < bb[1]:
            bb[1] = coord[1]
        elif coord[1] > bb[3]:
            bb[3] = coord[1]

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
        "accessPoints": [0],
        "tours": [],
    }

    for tour in sorted(os.listdir(folder)):
        tour_path = os.path.join(folder, tour)
        if os.path.isdir(tour_path):

            tour_entry = {
                "id": tour_id,
                "name": tour,
                "order": tour_id,
                "sets": [],
            }

            set_central_meridian = 0

            # Bounding box latitudine e longitudine
            # list float [bb_latitude_max, bb_latitude_min, bb_longitude_max, bb_longitude_min, bb_altitude_max, bb_altitude_min, validity flag]
            set_bb_latlon = [0,0,0,0,0,0,0]

            # Bounding box
            # list float [bb_easting_min, bb_northing_min, bb_easting_max, bb_northing_max, validity flag]
            set_bb = [0,0,0,0,0]

            for set in sorted(os.listdir(tour_path)):
                set_path = os.path.join(tour_path, set)
                if os.path.isdir(set_path):   

                    set_entry = {
                        "id": set_id,
                        "name": set,
                        "order": set_id,
                        "panos": [],
                    }

                    set_id += 1

                    set_central_meridian = 0
                    set_bb_latlon[6] = 0
                    set_bb[4] = 0

                    for file in sorted(os.listdir(set_path)):
                        f = os.path.join(set_path, file)

                        # tuple float (dd_latitude, dd_longitude, altitude)
                        gps = get_exif_gps(f)
                        
                        pano = {
                            "id": pano_id,
                            "url": set + "/" + file,
                            "label": set + " " + str(pano_id),
                            "priority": 0,
                            "skip": False,
                            "skipLinks": [],
                            "rotation": [],
                            "initialYaw": gps[3],
                            "horizontalPitch": 0,
                            "horizontalRoll": 0,
                            "latitude": gps[0],
                            "longitude": gps[1],
                            "altitude": gps[2],
                        }

                        set_entry["panos"].append(pano)
                        pano_id += 1

                        # calcolo del bounding box in latitudine e longitudine
                        calculate_latlon_bb(gps, set_bb_latlon)

                        # controllo se il bounding box è troppo grande
                        if (set_bb_latlon[2]-set_bb_latlon[3] > 6) :
                            raise ValueError(f"Area {set_entry['name']} is too big")
                    
                    # Calcolo il meridiano centrale della zona di proiezione
                    set_central_meridian = int((set_bb_latlon[2] + set_bb_latlon[3]) / 2)

                    # Inserimento del bounding box nel set_entry
                    set_entry["boundingbox_latlon"] = {
                        "latitude_max": set_bb_latlon[0],
                        "latitude_min": set_bb_latlon[1],
                        "longitude_max": set_bb_latlon[2],
                        "longitude_min": set_bb_latlon[3],
                        "altitude_max": set_bb_latlon[4],
                        "altitude_min": set_bb_latlon[5]
                    }

                    # Iterazione sugli elementi del set_entry per calcolare le coordinate rispetto la proiezione scelta e il relativo bounding box
                    for pano in set_entry["panos"]:
                        # Calcolo della proiezione
                        coord = coord_projection(pano["latitude"], pano["longitude"], set_central_meridian)

                        # # Inserimento delle coordinate nel set_entry
                        pano["easting"] = coord[0]
                        pano["northing"] = coord[1]

                        # Calcolo del bounding box
                        calculate_proj_bb(coord, set_bb)

                    # Inserimento del bounding box nel set_entry
                    set_entry["boundingbox"] = {
                        "easting_min": set_bb[0],
                        "northing_min": set_bb[1],
                        "easting_max": set_bb[2],
                        "northing_max": set_bb[3]
                    }

                    # Iterazione sugli elementi del set_entry per calcolare la traslazione rispetto al vertice in basso a sinistra del bounding box
                    for pano in set_entry["panos"]:
                        pano["translation"] = [
                            (pano["easting"] - set_entry["boundingbox"]["easting_min"]),
                            (pano["northing"] - set_entry["boundingbox"]["northing_min"])
                            ]
                        
                        pano.pop("easting")
                        pano.pop("northing")

                    tour_entry["sets"].append(set_entry)

            dataset["tours"].append(tour_entry)
            tour_id += 1
            set_id = 0

    # Converto il dictionary in una stringa JSON
    json_string = json.dumps(dataset)

    # Uso jsbeautifier per formattare la stringa JSON
    formatted_json = jsbeautifier.beautify(json_string)

    # Scrivo la stringa JSON formattata nel file
    with open(f'{output}.json', 'w') as json_file:
        json_file.write(formatted_json)

# https://exiv2.org/tags.html
# https://pillow.readthedocs.io/en/stable/_modules/PIL/ExifTags.html#GPS