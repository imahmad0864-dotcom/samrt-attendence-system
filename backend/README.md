# Smart Attendance Backend (Express + MongoDB + FastAPI)

This is a starter backend for a face-based smart attendance system. Express owns users, student records, authorization, attendance rules, and MongoDB. FastAPI owns face detection and matching.

## Requirements

- Node.js 18+
- MongoDB running locally or a MongoDB connection string
- Python environment for the FastAPI service
- The FastAPI service must expose `POST /face/enroll` and `POST /face/recognize` (the included `fastapi-face-service/main.py` does).

## 1. Configure Express

```bash
npm install
cp .env.example .env
```

Set a random `JWT_SECRET` of at least 32 characters and check `MONGODB_URI`, `FACE_API_URL`, and `CORS_ORIGIN`.

## 2. Start the included FastAPI service

Copy `fastapi-face-service/main.py` into your existing face-service folder (back up the old file first). Keep the existing `requirements.txt`, or install the packages from it.

```bash
cd fastapi-face-service
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

Run this in its own terminal. First model startup may download pretrained weights if not cached.

## 3. Start Express

In the project root:

```bash
npm run dev
```

Express listens at `http://localhost:5000`.

## 4. Create the first admin

The first admin setup endpoint works only when the User collection is empty:

`POST /api/auth/setup`
```json
{
  "name": "System Admin",
  "email": "admin@example.com",
  "password": "use-a-long-unique-password"
}
```

Password must be at least 12 characters. Then sign in:

`POST /api/auth/login`
```json
{ "email": "admin@example.com", "password": "use-a-long-unique-password" }
```

Use the returned token as `Authorization: Bearer <token>`.

## 5. Add a student

Create metadata:

`POST /api/students`
```json
{
  "studentId": "STU-1001",
  "name": "Ayesha Khan",
  "email": "ayesha@example.com",
  "className": "BSCS-3A"
}
```

Then enroll one clear image with exactly one face:

`POST /api/students/<mongoStudentId>/face`

Use `multipart/form-data`, field name `frame`, and attach a JPG/PNG/WEBP image. Express forwards it to FastAPI. The FastAPI service stores the enrollment image in its `face_dataset` folder and refreshes its in-memory reference embeddings.

## 6. Mark attendance

`POST /api/attendance/recognize`

Use `multipart/form-data` with a single image in field `frame`. If the face matches an active enrolled student, Express writes one attendance record for that student for the server's current calendar date. Duplicate attendance for the same student/date returns HTTP 409.

The frontend should send a camera frame as a Blob/File, not a base64 data URL, where possible.

## API overview

- `GET /api/health`
- `POST /api/auth/setup` (first admin only)
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/users` (admin)
- `GET /api/students`
- `GET /api/students/:id`
- `POST /api/students` (admin)
- `POST /api/students/:id/face` (admin)
- `PATCH /api/students/:id` (admin)
- `DELETE /api/students/:id` (admin; soft deactivates)
- `POST /api/attendance/recognize`
- `GET /api/attendance?date=YYYY-MM-DD`
- `GET /api/attendance?studentId=STU-1001`
- `GET /api/attendance/student/:studentId`

All student and attendance endpoints require a bearer token. Student creation, enrollment, updates, deactivation, and user creation require the admin role.

## Important notes before production

- Face recognition is probabilistic. Calibrate the similarity threshold against your own dataset and camera conditions.
- Face matching alone does not provide liveness/anti-spoofing.
- Protect face images and embeddings as sensitive biometric data; obtain appropriate consent, restrict access, encrypt storage/transit, and set a retention/deletion policy.
- This starter stores one enrollment image per student in FastAPI's local `face_dataset`. Back up this folder and do not run multiple independent FastAPI instances with separate local folders without a shared enrollment store.
- The date key uses the server's local timezone. Configure the server timezone or implement an explicit institution timezone before deployment.
- The starter is not a complete school information system; add pagination, audit trails, backups, monitoring, and policy-specific attendance rules as needed.
