import os
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from insightface.app import FaceAnalysis
from supabase import create_client


# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_SECRET = os.environ["RECOGNITION_WORKER_SECRET"]

MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_l")
STRONG_THRESHOLD = float(os.getenv("FACE_STRONG_THRESHOLD", "0.62"))
REVIEW_THRESHOLD = float(os.getenv("FACE_REVIEW_THRESHOLD", "0.48"))


# ============================================================
# SERVICES
# ============================================================

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
)

engine = FaceAnalysis(
    name=MODEL_NAME,
    providers=["CPUExecutionProvider"]
)

engine.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="BIRITECH Facial Attendance Recognition Worker"
)


class RecognizeRequest(BaseModel):
    school_id: str
    class_id: str
    job_id: str


# ============================================================
# IMAGE HELPERS
# ============================================================

def decode_image(data: bytes):
    arr = np.frombuffer(data, dtype=np.uint8)

    img = cv2.imdecode(
        arr,
        cv2.IMREAD_COLOR
    )

    if img is None:
        raise ValueError("Could not decode image")

    return img


def normalized(v):
    v = np.asarray(
        v,
        dtype=np.float32
    )

    n = np.linalg.norm(v)

    return v / n if n else v


def face_embeddings(image):
    faces = engine.get(image)

    out = []

    for f in faces:

        emb = normalized(
            f.embedding
        )

        bbox = [
            float(x)
            for x in f.bbox.tolist()
        ]

        out.append({
            "embedding": emb,
            "bbox": bbox
        })

    return out


# ============================================================
# REFERENCE FACE
# ============================================================

def reference_embedding(paths: List[str]):

    vectors = []

    for path in paths:

        try:

            data = (
                supabase.storage
                .from_("student-face-enrollment")
                .download(path)
            )

            img = decode_image(data)

            faces = face_embeddings(img)

            # Enrollment image should contain exactly one face
            if len(faces) != 1:
                continue

            vectors.append(
                faces[0]["embedding"]
            )

        except Exception as exc:

            print(
                f"Reference image error for {path}: {exc}",
                flush=True
            )

            continue

    if not vectors:
        return None

    return normalized(
        np.mean(
            np.stack(vectors),
            axis=0
        )
    )


def cosine(a, b):

    return float(
        np.dot(a, b)
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "ok": True,
        "model": MODEL_NAME
    }


# ============================================================
# RECOGNITION
# ============================================================

@app.post("/recognize")
def recognize(
    req: RecognizeRequest,
    x_worker_secret: str = Header(default="")
):

    # --------------------------------------------------------
    # SECURITY
    # --------------------------------------------------------

    if x_worker_secret != WORKER_SECRET:

        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )


    print(
        f"Recognition started | "
        f"job={req.job_id} "
        f"school={req.school_id} "
        f"class={req.class_id}",
        flush=True
    )


    # --------------------------------------------------------
    # LOAD RECOGNITION JOB
    # --------------------------------------------------------

    job_resp = (
        supabase
        .table("face_recognition_jobs")
        .select(
            "id,school_id,class_id,photo_paths,status"
        )
        .eq(
            "id",
            req.job_id
        )
        .eq(
            "school_id",
            req.school_id
        )
        .eq(
            "class_id",
            req.class_id
        )
        .limit(1)
        .execute()
    )


    if not job_resp.data:

        raise HTTPException(
            status_code=404,
            detail="Recognition job not found"
        )


    job = job_resp.data[0]


    # --------------------------------------------------------
    # GET STUDENTS FROM ENROLLMENTS
    #
    # IMPORTANT:
    # students DOES NOT contain class_id.
    #
    # Correct relationship:
    #
    # students.id
    #       ↓
    # enrollments.student_id
    # enrollments.class_id
    #       ↓
    # classes.id
    # --------------------------------------------------------

    enrollment_resp = (
        supabase
        .table("enrollments")
        .select(
            "student_id,class_id,academic_year_id,status"
        )
        .eq(
            "class_id",
            req.class_id
        )
        .eq(
            "status",
            "active"
        )
        .execute()
    )


    enrollment_rows = (
        enrollment_resp.data or []
    )


    student_ids = list({
        row["student_id"]
        for row in enrollment_rows
        if row.get("student_id")
    })


    print(
        f"Active class enrollments found: "
        f"{len(student_ids)}",
        flush=True
    )


    if not student_ids:

        return {
            "matches": [],
            "message":
                "No active students found in the selected class."
        }


    # --------------------------------------------------------
    # LOAD STUDENT DETAILS
    # --------------------------------------------------------

    student_resp = (
        supabase
        .table("students")
        .select(
            "id,full_name,admission_number,school_id,status"
        )
        .eq(
            "school_id",
            req.school_id
        )
        .in_(
            "id",
            student_ids
        )
        .execute()
    )


    class_students = (
        student_resp.data or []
    )


    print(
        f"Student records loaded: "
        f"{len(class_students)}",
        flush=True
    )


    if not class_students:

        return {
            "matches": [],
            "message":
                "No student records found for the selected class."
        }


    # Use only IDs that actually belong to this school
    valid_student_ids = [
        student["id"]
        for student in class_students
    ]


    # --------------------------------------------------------
    # LOAD FACE ENROLLMENTS
    # --------------------------------------------------------

    face_enroll_resp = (
        supabase
        .table("student_face_enrollments")
        .select(
            "student_id,"
            "reference_photo_paths,"
            "enrollment_status"
        )
        .eq(
            "school_id",
            req.school_id
        )
        .eq(
            "enrollment_status",
            "enrolled"
        )
        .in_(
            "student_id",
            valid_student_ids
        )
        .execute()
    )


    student_by_id = {
        student["id"]: student
        for student in class_students
    }


    gallery = []


    # --------------------------------------------------------
    # BUILD FACE GALLERY
    # --------------------------------------------------------

    for row in face_enroll_resp.data or []:

        student_id = row.get(
            "student_id"
        )


        if student_id not in student_by_id:
            continue


        emb = reference_embedding(
            row.get(
                "reference_photo_paths"
            ) or []
        )


        if emb is not None:

            gallery.append({
                "student":
                    student_by_id[
                        student_id
                    ],
                "embedding":
                    emb
            })


    print(
        f"Face gallery ready: "
        f"{len(gallery)} students",
        flush=True
    )


    if not gallery:

        return {
            "matches": [],
            "message":
                "No face-enrolled students are available in this class."
        }


    # --------------------------------------------------------
    # PROCESS CLASSROOM PHOTOS
    # --------------------------------------------------------

    matches = []

    face_counter = 0

    best_seen = {}


    for photo_path in (
        job.get("photo_paths") or []
    ):

        try:

            photo_bytes = (
                supabase.storage
                .from_(
                    "facial-attendance-classroom"
                )
                .download(
                    photo_path
                )
            )


            image = decode_image(
                photo_bytes
            )


            detected_faces = (
                face_embeddings(image)
            )


            print(
                f"Photo {photo_path}: "
                f"{len(detected_faces)} "
                f"face(s) detected",
                flush=True
            )


            for face in detected_faces:

                face_counter += 1

                ranked = []


                # --------------------------------------------
                # COMPARE FACE AGAINST CLASS GALLERY
                # --------------------------------------------

                for item in gallery:

                    score = cosine(
                        face["embedding"],
                        item["embedding"]
                    )

                    ranked.append(
                        (
                            score,
                            item["student"]
                        )
                    )


                if not ranked:
                    continue


                ranked.sort(
                    key=lambda x: x[0],
                    reverse=True
                )


                best_score, best_student = (
                    ranked[0]
                )


                # --------------------------------------------
                # CONFIDENCE CLASSIFICATION
                # --------------------------------------------

                if (
                    best_score
                    >= STRONG_THRESHOLD
                ):

                    status = "strong"

                elif (
                    best_score
                    >= REVIEW_THRESHOLD
                ):

                    status = "review"

                else:

                    status = "unknown"


                # --------------------------------------------
                # PREVENT DUPLICATE STUDENT MATCHES
                # --------------------------------------------

                if status != "unknown":

                    prior = best_seen.get(
                        best_student["id"]
                    )


                    if (
                        prior is not None
                        and
                        prior >= best_score
                    ):

                        continue


                    best_seen[
                        best_student["id"]
                    ] = best_score


                # --------------------------------------------
                # RESULT
                # --------------------------------------------

                matches.append({

                    "faceId":
                        f"{req.job_id}-{face_counter}",

                    "studentId":
                        best_student["id"]
                        if status != "unknown"
                        else None,

                    "studentName":
                        best_student["full_name"]
                        if status != "unknown"
                        else None,

                    "confidence":
                        round(
                            best_score,
                            4
                        ),

                    "status":
                        status,

                    "bbox":
                        face["bbox"],
                })


        except Exception as exc:

            print(
                f"Classroom photo processing error "
                f"for {photo_path}: {exc}",
                flush=True
            )

            raise


    # --------------------------------------------------------
    # SAVE RESULT
    # --------------------------------------------------------

    supabase.table(
        "face_recognition_jobs"
    ).update({

        "status":
            "completed",

        "result_json": {
            "matches":
                matches
        }

    }).eq(
        "id",
        req.job_id
    ).execute()


    print(
        f"Recognition completed | "
        f"faces={face_counter} "
        f"results={len(matches)}",
        flush=True
    )


    return {

        "matches":
            matches,

        "message":
            (
                f"Recognition completed: "
                f"{face_counter} "
                f"face"
                f"{'s' if face_counter != 1 else ''} "
                f"detected."
            )
    }
