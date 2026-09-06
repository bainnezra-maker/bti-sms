-- ============================================================
-- SCHOOL MANAGEMENT SYSTEM — FOUNDATION SCHEMA
-- Multi-tenant: every table that holds school-specific data
-- carries a school_id, so one database can serve many schools.
-- ============================================================

-- ---------- 1. SCHOOLS (the tenant) ----------
CREATE TABLE schools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    short_code      TEXT UNIQUE NOT NULL,       -- e.g. 'BTI' for Biriwa Technical Institute
    address         TEXT,
    phone           TEXT,
    email           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- 2. USERS & ROLES ----------
-- One users table for everyone who logs in (admin, teacher, staff).
-- Supabase Auth manages the actual login/password; this table
-- holds the profile + role + which school they belong to.
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'staff');

CREATE TABLE users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id),
    school_id       UUID NOT NULL REFERENCES schools(id),
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT,
    role            user_role NOT NULL,
    department      TEXT,
    employment_date DATE,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- 3. ACADEMIC CALENDAR ----------
CREATE TABLE academic_years (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    name            TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    is_current      BOOLEAN DEFAULT false
);

CREATE TABLE terms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id    UUID NOT NULL REFERENCES academic_years(id),
    name                TEXT NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_current          BOOLEAN DEFAULT false
);

-- ---------- 4. PROGRAMMES, SUBJECTS & CLASSES ----------
CREATE TABLE programmes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    name            TEXT NOT NULL
);

CREATE TABLE subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    name            TEXT NOT NULL,
    code            TEXT
);

CREATE TABLE classes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    programme_id    UUID REFERENCES programmes(id),
    name            TEXT NOT NULL,
    level           TEXT
);

CREATE TABLE teacher_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES users(id),
    class_id        UUID NOT NULL REFERENCES classes(id),
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    term_id         UUID NOT NULL REFERENCES terms(id)
);

-- ---------- 5. STUDENTS (SIS core) ----------
CREATE TYPE student_status AS ENUM ('active', 'graduated', 'withdrawn', 'suspended');

CREATE TABLE students (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           UUID NOT NULL REFERENCES schools(id),
    admission_number    TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    date_of_birth       DATE,
    gender              TEXT,
    guardian_name        TEXT,
    guardian_phone       TEXT,
    address             TEXT,
    admission_date      DATE NOT NULL,
    status              student_status DEFAULT 'active',
    UNIQUE (school_id, admission_number)
);

CREATE TABLE enrollments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES students(id),
    class_id            UUID NOT NULL REFERENCES classes(id),
    academic_year_id    UUID NOT NULL REFERENCES academic_years(id),
    enrollment_date     DATE NOT NULL,
    UNIQUE (student_id, academic_year_id)
);

-- ---------- 6. ATTENDANCE ----------
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE attendance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id),
    class_id        UUID NOT NULL REFERENCES classes(id),
    date            DATE NOT NULL,
    status          attendance_status NOT NULL,
    recorded_by     UUID REFERENCES users(id),
    UNIQUE (student_id, date)
);

-- ---------- 7. HR: STAFF LEAVE ----------
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE leave_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id        UUID NOT NULL REFERENCES users(id),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    reason          TEXT,
    status          leave_status DEFAULT 'pending',
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);
