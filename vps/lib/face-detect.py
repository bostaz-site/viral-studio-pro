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
                # Sort faces by area descending (largest first)
                face_list = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)

                # Primary face (largest)
                fx, fy, fw, fh = face_list[0]

                # All faces scaled to canvas coordinates
                all_faces = []
                for af_x, af_y, af_w, af_h in face_list:
                    all_faces.append({
                        "x": round(af_x * scale_x),
                        "y": round(af_y * scale_y),
                        "w": round(af_w * scale_x),
                        "h": round(af_h * scale_y),
                    })

                # Scale to canvas coordinates
                kf = {
                    "frame": frame_idx,
                    "t": round(frame_idx / fps, 4),
                    "x": round(fx * scale_x),
                    "y": round(fy * scale_y),
                    "w": round(fw * scale_x),
                    "h": round(fh * scale_y),
                    "detected": True,
                    "faces": all_faces,
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
        "keyframes": keyframes,
        "smoothed": smoothed,
    }


def smooth_keyframes(keyframes, fps, canvas_w, canvas_h):
    """
    Apply intelligent smoothing to raw face detections.
    Goal: calm cameraman feel — no jitter, no snaps, no nausea.

    Pipeline:
    1. Fill gaps with last known position (face disappears = camera holds)
    2. Dead zone: camera doesn't move unless face exits center 20%
    3. Max speed limit: camera never moves faster than 3% of canvas per sample
    4. Heavy inertia lerp (0.92-0.96) for velvet-smooth motion
    5. Rule of thirds offset (face in upper third)
    6. Safe zone clamp (never cuts face)
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
            # Face lost — camera holds at last known position (no drift)
            filled.append({"t": kf["t"], "cx": last_known["cx"], "cy": last_known["cy"],
                           "fw": last_known["fw"], "fh": last_known["fh"]})
        else:
            # No face detected yet — use center
            filled.append({"t": kf["t"], "cx": canvas_w // 2, "cy": canvas_h // 2,
                           "fw": canvas_w // 4, "fh": canvas_h // 4})

    if not filled:
        return []

    # ─── Step 2-4: Dead zone + speed limit + heavy inertia ───
    # Dead zone: face must move >10% from camera center before camera starts tracking
    # Max speed: camera moves at most 3% of canvas per sample (prevents snaps)
    # Inertia: 0.94 base (very heavy — calm cameraman)
    DEAD_ZONE = 0.10       # 10% of canvas before camera reacts
    MAX_SPEED = 0.03       # 3% of canvas per frame sample
    INERTIA = 0.94         # very heavy smoothing (higher = smoother)

    cam_cx = filled[0]["cx"]
    cam_cy = filled[0]["cy"]
    result = []

    for i, pt in enumerate(filled):
        target_cx = pt["cx"]
        target_cy = pt["cy"]

        # Distance from camera center to face center (normalized)
        dx_norm = (target_cx - cam_cx) / canvas_w
        dy_norm = (target_cy - cam_cy) / canvas_h
        dist_norm = (dx_norm ** 2 + dy_norm ** 2) ** 0.5

        # Dead zone: only start moving if face is outside center zone
        if dist_norm < DEAD_ZONE:
            # Face is close to camera center — don't move
            effective_target_cx = cam_cx
            effective_target_cy = cam_cy
        else:
            # Move toward face, but only the distance beyond the dead zone
            # This makes the camera "lag" slightly behind the face (natural feel)
            pull_factor = (dist_norm - DEAD_ZONE) / dist_norm
            effective_target_cx = cam_cx + (target_cx - cam_cx) * pull_factor
            effective_target_cy = cam_cy + (target_cy - cam_cy) * pull_factor

        # Apply inertia (heavy smoothing)
        new_cx = cam_cx * INERTIA + effective_target_cx * (1 - INERTIA)
        new_cy = cam_cy * INERTIA + effective_target_cy * (1 - INERTIA)

        # Max speed clamp: limit per-sample movement
        move_dx = new_cx - cam_cx
        move_dy = new_cy - cam_cy
        move_dist = (move_dx ** 2 + move_dy ** 2) ** 0.5
        max_move = MAX_SPEED * ((canvas_w ** 2 + canvas_h ** 2) ** 0.5)

        if move_dist > max_move and move_dist > 0:
            scale = max_move / move_dist
            new_cx = cam_cx + move_dx * scale
            new_cy = cam_cy + move_dy * scale

        cam_cx = new_cx
        cam_cy = new_cy

        # ─── Step 5: Rule of thirds offset ───
        offset_cy = cam_cy + canvas_h * 0.08

        # ─── Step 6: Safe zone clamp ───
        margin_x = canvas_w * 0.15
        margin_top = canvas_h * 0.10
        margin_bot = canvas_h * 0.12

        clamped_cx = max(margin_x, min(canvas_w - margin_x, cam_cx))
        clamped_cy = max(margin_top, min(canvas_h - margin_bot, offset_cy))

        result.append({
            "t": round(pt["t"], 4),
            "cx": round(clamped_cx),
            "cy": round(clamped_cy),
            "zoom": 1.0,
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
