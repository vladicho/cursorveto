import base64
import io
import os

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image
from skimage import color, filters, measure, morphology, transform


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 24 * 1024 * 1024


def decode_data_url(data_url):
    if not data_url or "," not in data_url:
        raise ValueError("Imagem ausente.")
    _, encoded = data_url.split(",", 1)
    raw = base64.b64decode(encoded)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.asarray(image)


def resize_image(image, max_side=900):
    height, width = image.shape[:2]
    scale = min(1.0, max_side / max(width, height))
    if scale >= 1:
        return image
    new_size = (max(1, round(height * scale)), max(1, round(width * scale)))
    resized = transform.resize(image, new_size, preserve_range=True, anti_aliasing=True)
    return resized.astype(np.uint8)


def largest_component(mask):
    labels = measure.label(mask)
    regions = measure.regionprops(labels)
    if not regions:
        return None
    region = max(regions, key=lambda item: item.area)
    return labels == region.label


def contour_points(mask, max_points):
    contours = measure.find_contours(mask.astype(float), 0.5)
    if not contours:
        return []
    contour = max(contours, key=len)
    tolerance = max(2.0, min(mask.shape) * 0.006)
    simplified = measure.approximate_polygon(contour, tolerance=tolerance)
    if len(simplified) > max_points:
        step = max(1, int(np.ceil(len(simplified) / max_points)))
        simplified = simplified[::step]
    return [{"x": float(col), "y": float(row)} for row, col in simplified]


def authorized_request():
    expected = os.environ.get("SKIMAGE_SHARED_SECRET", "")
    if not expected:
        return True
    provided = request.headers.get("X-MoldeLab-Secret", "")
    return provided == expected


@app.get("/health")
def health():
    return jsonify(ok=True)


@app.post("/digitize/scikit")
def digitize_scikit():
    if not authorized_request():
        return jsonify(ok=False, error="Nao autorizado."), 401
    try:
        payload = request.get_json(force=True)
        max_points = int(payload.get("maxPoints", 220))
        image = resize_image(decode_data_url(payload.get("dataUrl")))
        gray = color.rgb2gray(image)
        threshold = filters.threshold_otsu(gray)

        border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
        foreground = gray < threshold if float(border.mean()) > threshold else gray > threshold
        foreground = morphology.remove_small_objects(foreground, min_size=96)
        foreground = morphology.binary_closing(foreground, morphology.disk(3))
        foreground = morphology.binary_opening(foreground, morphology.disk(1))
        component = largest_component(foreground)
        if component is None or int(component.sum()) < 80:
            return jsonify(ok=False, error="Nenhum contorno forte encontrado."), 422

        points = contour_points(component, max_points)
        if len(points) < 8:
            return jsonify(ok=False, error="Contorno insuficiente."), 422

        height, width = component.shape
        return jsonify(ok=True, width=width, height=height, points=points)
    except Exception as error:
        return jsonify(ok=False, error=str(error)), 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port)
