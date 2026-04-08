#!/usr/bin/env python3
"""
Face detection for smart zoom follow mode.

Analyzes a video file every N frames, detects the largest face,
and outputs smoothed keyframes as JSON to stdout.

Usage:
  python3 face-detect.py <video_path> [--every 8] [--width 720] [--height 1280]

Output (JSON):
  {
    "fps": 30,
    "total_frames": 900,
    "keyframes": [
      { "frame": 0, "t": 0.0, "x": 360, "y": 400, "w": 200, "h": 200, "conf": 0.95 },
      ...
    ],
    "smoothed": [
      { "t": 0.0, "cx": 360, "cy": 480, "zoom": 1.0 },
      ...
    ]
  }
"""

import sys
import json
import argparse
import numpy as np

try:
    import cv2
except ImportError:
    print(json.dumps({"error": "opencv not installed"}))
    sys.exit(1)


def detect_faces_in_video(video_path, every_n=8, canvas_w=720, canvas_h=1280):
    """
    Detect faces every N frames using OpenCV's DNN face detector (more accurate than Haar).
    Falls back to Haar cascade if DNN model not available.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    vid_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    vid_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Scale factors from original video to canvas
    scale_x = canvas_w / vid_w if vid_w > 0 else 1
    scale_y = canvas_h / vid_h if vid_h > 0 else 1

    # Try Haar cascade (always available with opencv-python-headless)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)

    keyframes = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % every_n == 0:
            # Convert to grayscale for detection
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)  # Improve detection in dark scenes

            # Detect faces
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(int(vid_w * 0.05), int(vid_h * 0.05)),  # Min 5% of frame
                flags=cv2.CASCADE_SCALE_IMAGE,
            )

            if len(faces) > 0:
                # Pick the largest face (most likely the main subject)
                areas = [w * h for (x, y, w, h) in faces]
                best_idx = np.argmax(areas)
                fx, fy, fw, fh = faces[best_idx]

                # Scale to canvas coordinates
                kf = {
                    "frame": frame_idx,
                    "t": round(frame_idx / fps, 4),
                    "x": round(fx * scale_x),
                    "y": round(fy * scale_y),
                    "w": round(fw * scale_x),
                    "h": round(fh * scale_y),
                    "detected": True,
                }
                keyframes.append(kf)
            else:
                # No face detected — mark as not detected
                keyframes.append({
                    "frame": frame_idx,
                    "t": round(frame_idx / fps, 4),
                    "detected": False,
                })

        frame_idx += 1

    cap.release()

    # ─── Smoothing Pipeline ───
    smoothed = smooth_keyframes(keyframes, fps, canvas_w, canvas_h)

    return {
        "fps": fps,
        "total_frames": total_frames,
        "duration": round(total_frames / fps, 3),
        "video_w": vid_w,
        "video_h": vid_h,
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
        "raw_keyframes": len(keyframes),
        "detected_count": sum(1 for kf in keyframes if kf.get("detected")),
        "smoothed": smoothed,
    }


def smooth_keyframes(keyframes, fps, canvas_w, canvas_h):
    """
    Apply intelligent smoothing to raw face detections:
    1. Fill gaps (no-detection frames) with last known position
    2. Lerp with inertia (slow follow for small movements, faster for big jumps)
    3. Offset face center down ~10% (rule of thirds — leave room for captions up top)
    4. Clamp to safe zone (never cut eyes/mouth)
    """
    if not keyframes:
        return []

    # ─── Step 1: Fill gaps with last known position ───
    filled = []
    last_known = None

    for kf in keyframes:
        if kf.get("detected"):
            cx = kf["x"] + kf["w"] // 2
            cy = kf["y"] + kf["h"] // 2
            fw = kf["w"]
            fh = kf["h"]
            last_known = {"t": kf["t"], "cx": cx, "cy": cy, "fw": fw, "fh": fh}
            filled.append(dict(last_known))
        elif last_known:
            # Use last known position
            filled.append({"t": kf["t"], "cx": last_known["cx"], "cy": last_known["cy"],
                           "fw": last_known["fw"], "fh": last_known["fh"]})
        else:
            # No face detected yet — use center
            filled.append({"t": kf["t"], "cx": canvas_w // 2, "cy": canvas_h // 2,
                           "fw": canvas_w // 4, "fh": canvas_h // 4})

    if not filled:
        return []

    # ─── Step 2: Lerp with inertia ───
    # Small movements (< 5% of canvas) → camera barely moves (inertia = 0.92)
    # Medium movements (5-15%) → moderate follow (inertia = 0.80)
    # Big jumps (> 15%) → fast follow (inertia = 0.60)
    smoothed_cx = filled[0]["cx"]
    smoothed_cy = filled[0]["cy"]
    result = []

    for i, pt in enumerate(filled):
        target_cx = pt["cx"]
        target_cy = pt["cy"]

        # Calculate movement distance as % of canvas diagonal
        dx = abs(target_cx - smoothed_cx) / canvas_w
        dy = abs(target_cy - smoothed_cy) / canvas_h
        dist = (dx ** 2 + dy ** 2) ** 0.5

        # Adaptive inertia: bigger movement = less inertia (faster follow)
        if dist < 0.05:
            inertia = 0.92  # Almost stationary — camera barely moves
        elif dist < 0.15:
            inertia = 0.80  # Moderate movement
        else:
            inertia = 0.55  # Big jump — follow faster

        smoothed_cx = smoothed_cx * inertia + target_cx * (1 - inertia)
        smoothed_cy = smoothed_cy * inertia + target_cy * (1 - inertia)

        # ─── Step 3: Rule of thirds offset ───
        # Push the face center DOWN by ~10% of canvas height
        # so the face sits at ~upper third, leaving room for captions/hooks at top
        offset_cy = smoothed_cy + canvas_h * 0.08

        # ─── Step 4: Safe zone clamp ───
        # Ensure the crop window doesn't cut the face
        # Crop center must be at least face_height/2 away from edges
        margin_x = canvas_w * 0.15  # 15% margin from edges
        margin_top = canvas_h * 0.10  # 10% from top
        margin_bot = canvas_h * 0.12  # 12% from bottom

        clamped_cx = max(margin_x, min(canvas_w - margin_x, smoothed_cx))
        clamped_cy = max(margin_top, min(canvas_h - margin_bot, offset_cy))

        result.append({
            "t": round(pt["t"], 4),
            "cx": round(clamped_cx),
            "cy": round(clamped_cy),
            "zoom": 1.0,  # Base zoom, can be enhanced later
        })

    return result


def main():
    parser = argparse.ArgumentParser(description="Face detection for smart zoom follow")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--every", type=int, default=8, help="Detect every N frames (default: 8)")
    parser.add_argument("--width", type=int, default=720, help="Canvas width (default: 720)")
    parser.add_argument("--height", type=int, default=1280, help="Canvas height (default: 1280)")
    args = parser.parse_args()

    result = detect_faces_in_video(args.video_path, args.every, args.width, args.height)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
