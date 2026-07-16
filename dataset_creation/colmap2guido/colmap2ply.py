import argparse

import numpy as np
from scipy.spatial.transform import Rotation as R

def parse_images_txt(filename):
    """
    Parse COLMAP images.txt file.
    Returns a list of camera translation vectors.
    """
    camera_positions = []
    with open(filename, 'r') as f:
        lines = f.readlines()

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        parts = line.split()
        # Each camera line starts with an integer IMAGE_ID
        if parts[0].isdigit():
            # IMAGE_ID, QW, QX, QY, QZ, TX, TY, TZ, CAMERA_ID, NAME
            qw, qx, qy, qz = map(float, parts[1:5])
            tx, ty, tz = map(float, parts[5:8])

            rotation = quaternion_to_matrix44(qw, qx, qy, qz)
            tr  = np.array([tx, ty, tz], dtype=float)

            tr = -rotation[:3, :3].T @ tr  # convert to camera center
            camera_positions.append(tr)

    return np.array(camera_positions)

def quaternion_to_matrix44(qw, qx, qy, qz) -> np.ndarray:
    """
    Convert COLMAP quaternion (qw, qx, qy, qz) to 4x4 rotation matrix.
    SciPy expects (x, y, z, w).
    """
    rot = R.from_quat([qx, qy, qz, qw])
    M = np.eye(4, dtype=float)
    M[:3, :3] = rot.as_matrix()
    return M

def write_ply(filename, camera_positions, points3d):
    """
    Export camera positions (red) and 3D points (white) to a PLY file.
    """
    vertices = []
    colors = []

    # Cameras → red
    for p in camera_positions:
        vertices.append(p)
        colors.append([255, 0, 0])

    # 3D points → white
    for p in points3d:
        vertices.append(p)
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


if __name__ == "__main__":
    # Example usage
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_images_file", type=str, required=True)
    parser.add_argument("--input_points_file", type=str, required=True)

    args = parser.parse_args()
    
    images_file =args.input_images_file
    points3d_file = args.input_points_file  # optional, if you have it

    # Parse camera positions
    camera_positions = parse_images_txt(images_file)

    # Load 3D points if available
    points3d = []
    try:
        with open(points3d_file, 'r') as f:
            for line in f:
                if not line.strip() or line.startswith('#'):
                    continue
                parts = line.split()
                # POINT3D_ID, X, Y, Z, R, G, B, ERROR, TRACK[]
                x, y, z = map(float, parts[1:4])
                points3d.append([x, y, z])
    except FileNotFoundError:
        print("⚠️ points3D.txt not found — exporting cameras only.")

    write_ply("scene.ply", camera_positions, points3d)
