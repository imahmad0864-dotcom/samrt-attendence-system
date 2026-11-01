from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
import re

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from facenet_pytorch import InceptionResnetV1, MTCNN

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "face_dataset"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
SIMILARITY_THRESHOLD = 0.80


class FaceRecognitionService:
    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.detector = MTCNN(image_size=160, margin=0, device=self.device)
        self.recognizer = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        self.known_embeddings: list[torch.Tensor] = []
        self.known_names: list[str] = []
        DATASET_DIR.mkdir(parents=True, exist_ok=True)
        self.load_reference_faces()

    @torch.inference_mode()
    def _embedding_for_image(self, image_bgr: np.ndarray) -> torch.Tensor:
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        boxes, probabilities = self.detector.detect(image_rgb)
        if boxes is None or len(boxes) == 0:
            raise ValueError("No face detected in the image.")
        if len(boxes) != 1:
            raise ValueError("Please upload an image containing exactly one face.")
        face_tensor = self.detector.extract(image_rgb, boxes, save_path=None)
        if face_tensor is None:
            raise ValueError("Could not process the detected face.")
        if face_tensor.ndim == 3:
            face_tensor = face_tensor.unsqueeze(0)
        return self.recognizer(face_tensor[0:1].to(self.device))[0].detach().cpu()

    @torch.inference_mode()
    def load_reference_faces(self) -> None:
        self.known_embeddings.clear()
        self.known_names.clear()
        DATASET_DIR.mkdir(parents=True, exist_ok=True)
        for image_path in sorted(DATASET_DIR.iterdir()):
            if image_path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            image_bgr = cv2.imread(str(image_path))
            if image_bgr is None:
                continue
            try:
                embedding = self._embedding_for_image(image_bgr)
            except ValueError:
                continue
            # Filename format is <student_id>_enrollment.jpg
            student_id = image_path.stem.removesuffix("_enrollment")
            self.known_embeddings.append(embedding)
            self.known_names.append(student_id)

    @torch.inference_mode()
    def enroll(self, student_id: str, image_bgr: np.ndarray) -> dict[str, Any]:
        if not re.fullmatch(r"[A-Za-z0-9-]{1,64}", student_id):
            raise ValueError("student_id may contain only letters, numbers, and hyphens (max 64 characters).")
        embedding = self._embedding_for_image(image_bgr)
        # Save the reference image only after validating that exactly one face can be processed.
        output_path = DATASET_DIR / f"{student_id}_enrollment.jpg"
        ok = cv2.imwrite(str(output_path), image_bgr)
        if not ok:
            raise RuntimeError("Could not save enrollment image.")
        # Replace any existing in-memory entry for this student.
        keep = [(e, n) for e, n in zip(self.known_embeddings, self.known_names) if n != student_id]
        self.known_embeddings = [item[0] for item in keep]
        self.known_names = [item[1] for item in keep]
        self.known_embeddings.append(embedding)
        self.known_names.append(student_id)
        return {
            "success": True,
            "enrolled": True,
            "person_id": student_id,
            "reference_faces_loaded": len(self.known_embeddings),
            "message": "Face enrolled successfully."
        }

    @torch.inference_mode()
    def recognize(self, image_bgr: np.ndarray) -> dict[str, Any]:
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        boxes, _ = self.detector.detect(image_rgb)
        if boxes is None or len(boxes) == 0:
            return {"success": True, "face_detected": False, "matched": False, "message": "No face detected."}
        if len(boxes) != 1:
            return {
                "success": True, "face_detected": True, "matched": False,
                "face_count": int(len(boxes)),
                "message": "Please submit a frame containing exactly one face."
            }
        if not self.known_embeddings:
            return {
                "success": False, "face_detected": True, "matched": False,
                "message": "No reference faces are enrolled yet."
            }
        current_embedding = self._embedding_for_image(image_bgr)
        similarities = [
            F.cosine_similarity(reference.unsqueeze(0), current_embedding.unsqueeze(0)).item()
            for reference in self.known_embeddings
        ]
        best_index = int(np.argmax(similarities))
        best_similarity = float(similarities[best_index])
        matched = best_similarity >= SIMILARITY_THRESHOLD
        return {
            "success": True,
            "face_detected": True,
            "matched": matched,
            "person_id": self.known_names[best_index] if matched else None,
            "similarity": round(best_similarity, 4),
            "threshold": SIMILARITY_THRESHOLD,
            "message": "Match found." if matched else "No matching reference face found."
        }


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.face_service = FaceRecognitionService()
    yield
    del app.state.face_service


app = FastAPI(title="Face Recognition Service", version="1.1.0", lifespan=lifespan)


async def read_image(frame: UploadFile) -> np.ndarray:
    if frame.content_type and not frame.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload an image file.")
    image_bytes = await frame.read(MAX_IMAGE_BYTES + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded frame is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 8 MB limit.")
    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    image_bgr = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image.")
    return image_bgr


@app.get("/health")
def health() -> dict[str, Any]:
    service = getattr(app.state, "face_service", None)
    if service is None:
        return {"status": "starting"}
    return {
        "status": "ok",
        "device": str(service.device),
        "reference_faces_loaded": len(service.known_embeddings)
    }


@app.post("/face/enroll")
async def enroll_face(student_id: str = Form(...), frame: UploadFile = File(...)) -> dict[str, Any]:
    image_bgr = await read_image(frame)
    try:
        return app.state.face_service.enroll(student_id, image_bgr)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Face enrollment error: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=500, detail="Face enrollment failed.") from exc


@app.post("/face/recognize")
async def recognize_face(frame: UploadFile = File(...)) -> dict[str, Any]:
    image_bgr = await read_image(frame)
    try:
        return app.state.face_service.recognize(image_bgr)
    except Exception as exc:
        print(f"Face recognition error: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=500, detail="Face recognition failed.") from exc
