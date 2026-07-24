import sys
import cv2
import numpy as np

def process_signature(input_path, output_path):
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print("Failed to read image")
        sys.exit(1)

    # 1. Blur to remove minor noise
    img = cv2.GaussianBlur(img, (5, 5), 0)

    # 2. Adaptive Threshold (Inverse)
    # Background becomes 0 (black), strokes become 255 (white)
    thresh = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 10
    )

    # 3. Clean up strokes using morphology
    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    # Optional: remove tiny noise specks
    kernel_open = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open)

    # 4. Create transparent PNG
    h, w = thresh.shape
    bgr = np.zeros((h, w, 3), dtype=np.uint8) # Black ink

    # Use the thresholded image as the Alpha channel
    rgba = cv2.merge([bgr[:,:,0], bgr[:,:,1], bgr[:,:,2], thresh])

    # 5. Crop to bounding box of the signature to save space
    coords = cv2.findNonZero(thresh)
    if coords is not None:
        x, y, w, h_rect = cv2.boundingRect(coords)
        rgba = rgba[y:y+h_rect, x:x+w]
        # Add 10px padding
        padding = 10
        rgba = cv2.copyMakeBorder(rgba, padding, padding, padding, padding, cv2.BORDER_CONSTANT, value=[0, 0, 0, 0])

    cv2.imwrite(output_path, rgba)
    print("Success")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_signature.py <input> <output>")
        sys.exit(1)
    
    process_signature(sys.argv[1], sys.argv[2])
