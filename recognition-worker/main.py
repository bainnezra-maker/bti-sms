import os
from typing import List
import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from insightface.app import FaceAnalysis
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_SECRET = os.environ["RECOGNITION_WORKER_SECRET"]
MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_l")
STRONG_THRESHOLD = float(os.getenv("FACE_STRONG_THRESHOLD", "0.62"))
REVIEW_THRESHOLD = float(os.getenv("FACE_REVIEW_THRESHOLD", "0.48"))

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
engine = FaceAnalysis(name=MODEL_NAME, providers=["CPUExecutionProvider"])
engine.prepare(ctx_id=-1, det_size=(640, 640))

app = FastAPI(title="BIRITECH Facial Attendance Recognition Worker")

class RecognizeRequest(BaseModel):
    school_id: str
    class_id: str
    job_id: str

def decode_image(data: bytes):
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img

def normalized(v):
    v = np.asarray(v, dtype=np.float32)
    n = np.linalg.norm(v)
    return v / n if n else v

def face_embeddings(image):
    faces = engine.get(image)
    out = []
    for f in faces:
        emb = normalized(f.embedding)
        bbox = [float(x) for x in f.bbox.tolist()]
        out.append({"embedding": emb, "bbox": bbox})
    return out

def reference_embedding(paths: List[str]):
    vectors = []
    for path in paths:
        data = supabase.storage.from_("student-face-enrollment").download(path)
        img = decode_image(data)
        faces = face_embeddings(img)
        if len(faces) != 1:
            continue
        vectors.append(faces[0]["embedding"])
    if not vectors:
        return None
    return normalized(np.mean(np.stack(vectors), axis=0))

def cosine(a, b):
    return float(np.dot(a, b))

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}

@app.post("/recognize")
def recognize(req: RecognizeRequest, x_worker_secret: str = Header(default="")):
    if x_worker_secret != WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    job_resp = (
        supabase.table("face_recognition_jobs")
        .select("id,school_id,class_id,photo_paths,status")
        .eq("id", req.job_id)
        .eq("school_id", req.school_id)
        .eq("class_id", req.class_id)
        .limit(1)
        .execute()
    )
    if not job_resp.data:
        raise HTTPException(status_code=404, detail="Recognition job not found")
    job = job_resp.data[0]

    # Students are restricted to the selected class BEFORE matching.
    student_resp = (
        supabase.table("students")
        .select("id,full_name,admission_number,class_id")
        .eq("school_id", req.school_id)
        .eq("class_id", req.class_id)
        .execute()
    )
    class_students = student_resp.data or []
    ids = [s["id"] for s in class_students]
    if not ids:
        return {"matches": [], "message": "No students found in the selected class."}

    enroll_resp = (
        supabase.table("student_face_enrollments")
        .select("student_id,reference_photo_paths,enrollment_status")
        .eq("school_id", req.school_id)
        .eq("enrollment_status", "enrolled")
        .in_("student_id", ids)
        .execute()
    )

    student_by_id = {s["id"]: s for s in class_students}
    gallery = []
    for row in enroll_resp.data or []:
        emb = reference_embedding(row.get("reference_photo_paths") or [])
        if emb is not None:
            gallery.append({
                "student": student_by_id[row["student_id"]],
                "embedding": emb
            })

    if not gallery:
        return {"matches": [], "message": "No face-enrolled students are available in this class."}

    matches = []
    face_counter = 0
    best_seen = {}

    for photo_path in job.get("photo_paths") or []:
        photo_bytes = supabase.storage.from_("facial-attendance-classroom").download(photo_path)
        image = decode_image(photo_bytes)

        for face in face_embeddings(image):
            face_counter += 1
            ranked = []
            for item in gallery:
                score = cosine(face["embedding"], item["embedding"])
                ranked.append((score, item["student"]))
            ranked.sort(key=lambda x: x[0], reverse=True)
            best_score, best_student = ranked[0]

            if best_score >= STRONG_THRESHOLD:
                status = "strong"
            elif best_score >= REVIEW_THRESHOLD:
                status = "review"
            else:
                status = "unknown"

            # Merge repeat appearances of the same strong/review student across photos.
            if status != "unknown":
                prior = best_seen.get(best_student["id"])
                if prior is not None and prior >= best_score:
                    continue
                best_seen[best_student["id"]] = best_score

            matches.append({
                "faceId": f"{req.job_id}-{face_counter}",
                "studentId": best_student["id"] if status != "unknown" else None,
                "studentName": best_student["full_name"] if status != "unknown" else None,
                "confidence": round(best_score, 4),
                "status": status,
                "bbox": face["bbox"],
            })

    supabase.table("face_recognition_jobs").update({
        "status": "completed",
        "result_json": {"matches": matches}
    }).eq("id", req.job_id).execute()

    return {
        "matches": matches,
        "message": f"Recognition completed: {face_counter} face{'s' if face_counter != 1 else ''} detected."
    }
