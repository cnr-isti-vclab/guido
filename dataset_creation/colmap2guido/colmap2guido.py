import json
from dataclasses import dataclass
import os
from typing import List
import numpy as np
from scipy.spatial.transform import Rotation as R
import re

# ---------- Data structures ----------

@dataclass
class Point2D:
    x: float
    y: float
    point3d_id: int

@dataclass
class ImageEntry:
    image_id: int
    rotation: np.ndarray      # 4x4 rotation matrix
    translation: np.ndarray   # 3-vector
    initialYaw: float
    camera_id: int
    orientation_id: int
    name: str
    points2d: List[Point2D]


# ---------- Parsing utilities ----------

def is_int(s: str) -> bool:
    try:
        int(s)
        return True
    except ValueError:
        return False

def quaternion_to_matrix44(qw, qx, qy, qz) -> np.ndarray:
    """
    Convert COLMAP quaternion (qw, qx, qy, qz) to 4x4 rotation matrix.
    SciPy expects (x, y, z, w).
    """
    rot = R.from_quat([qx, qy, qz, qw])
    M = np.eye(4, dtype=float)
    M[:3, :3] = rot.as_matrix()
    return M

def parse_points_line(line: str) -> List[Point2D]:
    tokens = line.strip().split()
    pts = []
    for i in range(0, len(tokens), 3):
        x = float(tokens[i])
        y = float(tokens[i + 1])
        pid = int(tokens[i + 2])
        pts.append(Point2D(x, y, pid))
    return pts

def parse_images_file(path: str,rots:str) -> List[ImageEntry]:
    global scale
    scale  = 4.0
    images: List[ImageEntry] = []

    with open(path, "r") as f:
        # remove comments and empty lines
        lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]

    i = 0
    while i < len(lines):
        parts = lines[i].split()

        # detect start of image block
        if not is_int(parts[0]):
            i += 1
            continue

        # header line
        image_id = int(parts[0])
        qw, qx, qy, qz = map(float, parts[1:5])
        tx, ty, tz = map(float, parts[5:8])
        camera_id = int(parts[8])

        prefix, path_str = parts[9].rsplit('/', 1)
        name = os.path.basename(path_str)
        m = re.search(r'\d+', prefix)
        orientation_id = m.group()


        i += 1

        # collect all following points2D lines until next integer-starting line
        points: List[Point2D] = []
        while i < len(lines):
            first = lines[i].split()[0]
            if is_int(first):  # next image block
                break
            points.extend(parse_points_line(lines[i]))
            i += 1

        if( orientation_id ==  "0"):

            M = np.loadtxt(rots+"/"+str(orientation_id)+"_rotation.txt") 

            rotation = quaternion_to_matrix44(qw, qx, qy, qz)
            translation = np.array([tx, ty, tz], dtype=float)

            translation = -rotation[:3, :3].T @ translation  # convert to camera center
            translation = translation* scale   # apply rotation from file
            
            rotation[:3, :3] = M.T @ rotation[:3, :3]  

            # dbg rotate 180° around x  
            rot180 = np.array([[1, 0, 0], [0, -1, 0], [0, 0, -1]])

            rotation[:3, :3] = rot180@rotation[:3, :3] 

            R = np.eye(4) 
            R[:3, :3] = rotation[:3, :3]

            #this assumes that the cameras are not in the XY plane
            north = np.array([0, 0, 1])
            north = R[:3, :3] @ north
            np.arctan2(north[2], north[0])

            #initialYaw is in 0-360
            # initialYaw is the angle between the camera's forward direction and the north direction projected onto the XZ plane
            # THis north direction if just a common reference direction for all the cameras, it does not have to be the real north direction. It is just a reference direction for all cameras.
            # It is used to keep the same orientation when moving from one camera to another.
            # THIS NEED TO BE REMOVED, is not necessary. We can store the current view direction in world space
            # and pass it along to the next cameas. Also, it wold work even if the cameras are not kind of complanar
            initialYaw = (1.0+np.arctan2(north[2], north[0])/3.1415)*180.0


            images.append(
                ImageEntry(
                    image_id=image_id,
                    rotation=R,
                    translation=translation,
                    camera_id=camera_id,
                    orientation_id=int(orientation_id),
                    name=name,
                    points2d=points,
                    initialYaw=initialYaw
                )
            )

    #return [images[3], images[10],images[15]]  # return only the first two images for debugging
    return images


# ---------- JSON export ----------

def export_to_json(images: List[ImageEntry],
                   dataset_name: str,
                   set_name: str,
                   output_path: str) -> None:
    panos = []
    N = len(images)


    #compute the plane approximation of the camera centers
    centers = np.array([img.translation for img in images])
    mean_center = np.mean(centers, axis=0)
    centered_centers = centers - mean_center
    u, s, vh = np.linalg.svd(centered_centers.T)
    plane_normal = u[:, 2]
    
    #build a frame with plane_normal as y axis
    y_axis = -plane_normal
    z_axis = np.cross(y_axis, [0, 0, 1])
    if np.linalg.norm(z_axis) == 0:
        z_axis = np.cross(y_axis, [0, 1, 0])
    z_axis /= np.linalg.norm(z_axis)
    x_axis = np.cross(y_axis, z_axis)
    x_axis /= np.linalg.norm(x_axis)

    frame = np.eye(4)
    frame[:3, 0] = x_axis
    frame[:3, 1] = y_axis
    frame[:3, 2] = z_axis
    frame[:3, 3] = mean_center

    #compute the inverse of the frame to transform camera centers to the plane coordinate system
    frame_inv = np.linalg.inv(frame)

    #dbg do not do any global transformation, just use the original camera centers
    frame_inv = np.eye(4)

    for idx, img in enumerate(images):
        # link to all other cameras by index
        links =   [str(j) for j in range(N) if j != idx]

        rotation = frame_inv[:3, :3] @ img.rotation[:3, :3]
        r4 = np.eye(4)
        r4[:3, :3] = rotation
        
        translation = frame_inv[:3, :3] @ img.translation + frame_inv[:3, 3]

        pano = {
            "id": str(idx),
            "url": "cavalieri/"+img.name,
            "rotation": r4.reshape(-1).tolist(),       # 4x4
            "translation": translation.tolist(), # 3
            "label": "LABEL"+str(idx),
            "skipLinks": [],
            "priority": 2,
            "initialYaw": img.initialYaw,
            "horizontalPitch": 0,
            "horizontalRoll": 0,
            "links": links,
            "set": set_name,
        }
        panos.append(pano)


    


    data = {
        "name": dataset_name,
        "sets": [
            {
                "set": set_name,
                "order": 0,
                "panos": panos,
            }
        ],
        "accessPoints": [0]
    }

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)


def add_frame(vertices,colors,R,T):
    """
    Add a frame to the vertices and colors lists based on the given rotation matrix R.
    The frame consists of three colored axes (red, green, blue) representing the x, y, and z axes.
    """
    global scale

    origin = T  # Use the translation vector as the origin for the frame
    R = R.T
    x_axis = R[:3, 0]   # Scale for visibility
    y_axis = R[:3, 1] 
    z_axis = R[:3, 2] 

    size= 2 * scale # Length of the axes for visibility

    # Add origin
    vertices.append(origin)
    colors.append([255, 255, 255])  # White for origin

    for i in range(1,10):
        # Add x-axis (red)
        vertices.append(origin + x_axis*size/10.0*float(i))
        colors.append([255, 0, 0])  # Red

        # Add y-axis (green)
        vertices.append(origin + y_axis*size/10.0*float(i))
        colors.append([0, 255, 0])  # Green

        # Add z-axis (blue)
        vertices.append(origin + z_axis*size/10.0*float(i))
        colors.append([0, 0, 255])  # Blue

def write_ply(filename, images, points3d):
    """
    Export camera positions (red) and 3D points (white) to a PLY file.
    """
    global scale

    vertices = []
    colors = []

    # Cameras → red
    for img in images:
        vertices.append(img.translation)
        colors.append([255, 0, 0])
        add_frame(vertices,colors,img.rotation,img.translation)


    # 3D points → white
    for p in points3d:
        vertices.append(np.array(p)*scale)
        colors.append([255, 255, 255])

    vertices = np.array(vertices)
    colors = np.array(colors)

    with open(filename, "w") as f:
        f.write("ply\n")
        f.write("format ascii 1.0\n")
        f.write(f"element vertex {len(vertices)}\n")
        f.write("property float x\n")
        f.write("property float y\n")
        f.write("property float z\n")
        f.write("property uchar red\n")
        f.write("property uchar green\n")
        f.write("property uchar blue\n")
        f.write("end_header\n")

        for v, c in zip(vertices, colors):
            f.write(f"{v[0]} {v[1]} {v[2]} {c[0]} {c[1]} {c[2]}\n")

    print(f"✅ PLY file written: {filename}")


# ---------- Main example ----------
import argparse
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_images_file", type=str, required=True)
    parser.add_argument("--rotation_folder", type=str, required=True)
    parser.add_argument("--input_points_file", type=str, required=False)

    args = parser.parse_args()

    #rots = args.rotation_folder
    #orientation_id = "0"  # Replace with actual orientation ID if needed
    #M = np.loadtxt(rots+"/"+"test.txt")
   # N = M@[1,1,1]


    images = parse_images_file(args.input_images_file, args.rotation_folder)
    points3d = []
    if args.input_points_file:
        try:
            with open(args.input_points_file, 'r') as f:
                for line in f:
                    if not line.strip() or line.startswith('#'):
                        continue
                    parts = line.split()
                    # POINT3D_ID, X, Y, Z, R, G, B, ERROR, TRACK[]
                    x, y, z = map(float, parts[1:4])
                    points3d.append([x, y, z])
            write_ply("output.ply", images, points3d)
        except FileNotFoundError:
            print("⚠️ points not found")

    export_to_json(
        images,
        dataset_name="DATASET_NAME",
        set_name="SET_NAME",
        output_path="dataset.json",
    )

    print(f"Exported {len(images)} images to output.json")
