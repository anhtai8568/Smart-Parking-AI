import cv2
import numpy as np
import hashlib

def get_aruco_dict(dict_type: int = None):
    """
    Returns the OpenCV ArUco dictionary.
    Defaults to DICT_4X4_250 (ideal for range detection, supports up to 250 IDs).
    """
    if dict_type is None:
        try:
            dict_type = cv2.aruco.DICT_4X4_250
        except AttributeError:
            # Fallback for some OpenCV versions
            dict_type = 2  # Integer value for DICT_4X4_250
            
    try:
        # OpenCV >= 4.7.0
        return cv2.aruco.getPredefinedDictionary(dict_type)
    except AttributeError:
        # OpenCV < 4.7.0 fallback
        return cv2.aruco.Dictionary_get(dict_type)

def get_aruco_id_from_license_plate(license_plate: str) -> int:
    """
    Deterministically hashes a license plate string to an ArUco ID between 0 and 249.
    """
    # Keep only alphanumeric characters and uppercase
    clean_plate = "".join(c for c in license_plate if c.isalnum()).upper()
    if not clean_plate:
        return 0
    # Generate MD5 hash of the license plate
    hash_object = hashlib.md5(clean_plate.encode("utf-8"))
    hash_hex = hash_object.hexdigest()
    # Modulo 250 to keep it in the valid range for DICT_4X4_250
    return int(hash_hex, 16) % 250

def generate_aruco_image(marker_id: int, size: int = 400, include_label: bool = True, custom_label: str = None) -> np.ndarray:
    """
    Generates an ArUco marker image with a white border and optional text label.
    
    Args:
        marker_id: The ID of the marker (0-249 for DICT_4X4_250).
        size: Size of the inner ArUco marker in pixels.
        include_label: Whether to write the ID text below the marker.
        custom_label: Custom text to write instead of default label.
        
    Returns:
        A BGR image (numpy array) containing the formatted marker.
    """
    dictionary = get_aruco_dict()
    
    # 1. Generate the base marker image
    try:
        # OpenCV >= 4.7.0
        marker_img = cv2.aruco.generateImageMarker(dictionary, marker_id, size)
    except AttributeError:
        # OpenCV < 4.7.0 fallback
        marker_img = cv2.aruco.drawMarker(dictionary, marker_id, size)
        
    # Standardize image to BGR (color) for adding borders and labels
    if len(marker_img.shape) == 2:
        marker_img = cv2.cvtColor(marker_img, cv2.COLOR_GRAY2BGR)
        
    # 2. Define padding and background size
    padding_top = 40
    padding_bottom = 80 if include_label else 40
    padding_sides = 40
    
    h, w, c = marker_img.shape
    new_h = h + padding_top + padding_bottom
    new_w = w + (padding_sides * 2)
    
    # Create white canvas
    canvas = np.ones((new_h, new_w, 3), dtype=np.uint8) * 255
    
    # Place marker onto the canvas (centered horizontally, near the top)
    canvas[padding_top:padding_top+h, padding_sides:padding_sides+w] = marker_img
    
    # 3. Add text label
    if include_label:
        text = custom_label if custom_label else f"ParkVision AI - ID: {marker_id}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        color = (0, 0, 0)  # Black text
        thickness = 2
        
        # Get text size to center it
        (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
        text_x = (new_w - text_width) // 2
        text_y = new_h - 30
        
        cv2.putText(canvas, text, (text_x, text_y), font, font_scale, color, thickness, cv2.LINE_AA)
        
    return canvas

if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Generate ArUco Markers for Parking System")
    parser.add_argument("--id", type=int, default=None, help="ArUco Marker ID to generate (0-249)")
    parser.add_argument("--plate", type=str, default=None, help="License plate to generate marker for")
    parser.add_argument("--size", type=int, default=400, help="Size of the marker in pixels")
    parser.add_argument("--output", type=str, default=None, help="Output file path")
    
    args = parser.parse_args()
    
    if args.id is None and args.plate is None:
        print("Error: You must provide either --id or --plate.")
        exit(1)
        
    marker_id = args.id
    custom_label = None
    
    if args.plate:
        marker_id = get_aruco_id_from_license_plate(args.plate)
        custom_label = f"BIEN SO: {args.plate.upper()} - ID: {marker_id}"
        print(f"Hashed license plate '{args.plate}' to ArUco ID: {marker_id}")
        
    if marker_id < 0 or marker_id >= 250:
        print("Error: ArUco ID must be between 0 and 249.")
        exit(1)
        
    img = generate_aruco_image(marker_id, args.size, custom_label=custom_label)
    
    output_path = args.output if args.output else f"aruco_{marker_id}.png"
    cv2.imwrite(output_path, img)
    print(f"Generated ArUco marker with ID {marker_id} and saved to: {output_path}")
