'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type AcademicYear = {
  id: string;
  name: string;
};

type Term = {
  id: string;
  name: string;
  academic_year_id: string;
};

type Programme = {
  id: string;
  name: string;
  code: string | null;
};

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  programme_id: string | null;
  academic_year_id: string | null;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
};

type Student = {
  id: string;
  full_name: string;
  admission_number: string;
};

type AssessmentRecord = {
  id: string;
  student_id: string;
  subject: string;
  assessment_type: string;
  score: number;
  max_score: number;
  term: string | null;
  created_at: string;
};

type ScoreEntry = {
  student_id: string;
  score: string;
};

export default function AssessmentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);

  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [assessmentType, setAssessmentType] = useState('CA1');
  const [maxScore, setMaxScore] = useState('30');

  const [scores, setScores] = useState<ScoreEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadRecords(school_id: string) {
    const { data } = await supabase
      .from('assessments')
      .select(
        'id, student_id, subject, assessment_type, score, max_score, term, created_at'
      )
      .eq('school_id', school_id)
      .order('created_at', { ascending: false })
      .limit(20);

    setRecords(data ?? []);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      setSchoolId(profile.school_id);

      const [
        academicYearsResult,
        programmesResult,
        classesResult,
        subjectsResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, name')
          .eq('school_id', profile.school_id)
          .order('name', { ascending: false }),

        supabase
          .from('programmes')
          .select('id, name, code')
          .eq('school_id', profile.school_id)
          .order('name'),

        supabase
          .from('classes')
          .select('id, name, level, programme_id, academic_year_id')
          .eq('school_id', profile.school_id)
          .order('name'),

        supabase
          .from('subjects')
          .select('id, name, code')
          .eq('school_id', profile.school_id)
          .order('name'),
      ]);

      const years = academicYearsResult.data ?? [];
      setAcademicYears(years);
      setProgrammes(programmesResult.data ?? []);
      setClasses(classesResult.data ?? []);
      setSubjects(subjectsResult.data ?? []);

      const currentYear =
        years.find(
          (year: AcademicYear) =>
            year.name === '2026/2027'
        ) ?? years[0];

      if (currentYear) {
        setAcademicYearId(currentYear.id);

        const { data: termRows } = await supabase
          .from('terms')
          .select('id, name, academic_year_id')
          .eq('academic_year_id', currentYear.id)
          .order('start_date');

        setTerms(termRows ?? []);

        const currentTerm =
          termRows?.find(
            (term: Term) => term.name === 'Term 1'
          ) ?? termRows?.[0];

        if (currentTerm) {
          setTermId(currentTerm.id);
        }
      }

      await loadRecords(profile.school_id);

      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    async function loadTerms() {
      if (!academicYearId) {
        setTerms([]);
        setTermId('');
        return;
      }

      const { data } = await supabase
        .from('terms')
        .select('id, name, academic_year_id')
        .eq('academic_year_id', academicYearId)
        .order('start_date');

      setTerms(data ?? []);

      if (data && data.length > 0) {
        setTermId(data[0].id);
      } else {
        setTermId('');
      }
    }

    loadTerms();
  }, [academicYearId]);

  useEffect(() => {
    async function loadStudents() {
      if (!classId || !academicYearId) {
        setStudents([]);
        setScores([]);
        return;
      }

      setLoadingStudents(true);
      setMessage('');

      const { data: enrollmentRows, error: enrollmentError } =
        await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', classId)
          .eq('academic_year_id', academicYearId)
          .eq('status', 'active');

      if (enrollmentError) {
        setMessage(`Error loading class: ${enrollmentError.message}`);
        setLoadingStudents(false);
        return;
      }

      const studentIds =
        enrollmentRows?.map((row) => row.student_id) ?? [];

      if (studentIds.length === 0) {
        setStudents([]);
        setScores([]);
        setLoadingStudents(false);
        return;
      }

      const { data: studentRows, error: studentError } =
        await supabase
          .from('students')
          .select('id, full_name, admission_number')
          .in('id', studentIds)
          .eq('status', 'active')
          .order('full_name');

      if (studentError) {
        setMessage(`Error loading students: ${studentError.message}`);
        setLoadingStudents(false);
        return;
      }

      const loadedStudents = studentRows ?? [];

      setStudents(loadedStudents);

      setScores(
        loadedStudents.map((student) => ({
          student_id: student.id,
          score: '',
        }))
      );

      setLoadingStudents(false);
    }

    loadStudents();
  }, [classId, academicYearId]);

  function updateScore(studentId: string, value: string) {
    setScores((current) =>
      current.map((entry) =>
        entry.student_id === studentId
          ? { ...entry, score: value }
          : entry
      )
    );
  }

  function fillAllScores(value: string) {
    setScores((current) =>
      current.map((entry) => ({
        ...entry,
        score: value,
      }))
    );
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    if (!schoolId || !userId) {
      setMessage('Your school profile could not be found.');
      return;
    }

    if (!academicYearId) {
      setMessage('Please select an academic year.');
      return;
    }

    if (!termId) {
      setMessage('Please select a term.');
      return;
    }

    if (!programmeId) {
      setMessage('Please select a programme.');
      return;
    }

    if (!classId) {
      setMessage('Please select a class.');
      return;
    }

    if (!subjectId) {
      setMessage('Please select a subject.');
      return;
    }

    const selectedSubject = subjects.find(
      (subject) => subject.id === subjectId
    );

    const selectedTerm = terms.find(
      (term) => term.id === termId
    );

    if (!selectedSubject || !selectedTerm) {
      setMessage('Subject or term could not be found.');
      return;
    }

    const maximum = Number(maxScore);

    if (!maximum || maximum <= 0) {
      setMessage('Maximum score must be greater than 0.');
      return;
    }

    const enteredScores = scores.filter(
      (entry) => entry.score.trim() !== ''
    );

    if (enteredScores.length === 0) {
      setMessage('Please enter at least one score.');
      return;
    }

    for (const entry of enteredScores) {
      const value = Number(entry.score);

      if (Number.isNaN(value) || value < 0 || value > maximum) {
        const student = students.find(
          (s) => s.id === entry.student_id
        );

        setMessage(
          `Invalid score for ${student?.full_name ?? 'student'}. Score must be between 0 and ${maximum}.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      for (const entry of enteredScores) {
        const numericScore = Number(entry.score);

        const { data: existing } = await supabase
          .from('assessments')
          .select('id')
          .eq('school_id', schoolId)
          .eq('student_id', entry.student_id)
          .eq('subject', selectedSubject.name)
          .eq('assessment_type', assessmentType)
          .eq('term', selectedTerm.name)
          .limit(1)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('assessments')
            .update({
              score: numericScore,
              max_score: maximum,
              recorded_by: userId,
            })
            .eq('id', existing.id);

          if (error) {
            throw error;
          }
        } else {
          const { error } = await supabase
            .from('assessments')
            .insert({
              school_id: schoolId,
              student_id: entry.student_id,
              subject: selectedSubject.name,
              assessment_type: assessmentType,
              score: numericScore,
              max_score: maximum,
              term: selectedTerm.name,
              recorded_by: userId,
            });

          if (error) {
            throw error;
          }
        }
      }

      setMessage(
        `${enteredScores.length} score${
          enteredScores.length === 1 ? '' : 's'
        } saved successfully.`
      );

      await loadRecords(schoolId);

      setScores((current) =>
        current.map((entry) => ({
          ...entry,
          score: '',
        }))
      );
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function studentName(id: string) {
    return (
      students.find((student) => student.id === id)?.full_name ??
      'Unknown'
    );
  }

  const filteredClasses = classes.filter((item) => {
    const programmeMatches =
      !programmeId || item.programme_id === programmeId;

    const yearMatches =
      !academicYearId ||
      !item.academic_year_id ||
      item.academic_year_id === academicYearId;

    return programmeMatches && yearMatches;
  });

  if (loading) {
    return (
      <p
        style={{
          textAlign: 'center',
          marginTop: 60,
        }}
      >
        Loading…
      </p>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: '24px 16px 50px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Assessment Management
          </h1>

          <p
            style={{
              margin: '4px 0 0',
              color: '#666',
              fontSize: 14,
            }}
          >
            Enter and manage class assessment scores
          </p>
        </div>

        <Link href="/students">
          <button type="button">Student records</button>
        </Link>
      </div>

      {/* Assessment Setup */}
      <div
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Assessment Setup
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {/* Academic Year */}
          <div>
            <label style={labelStyle}>
              Academic Year
            </label>

            <select
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setClassId('');
                setStudents([]);
                setScores([]);
              }}
              style={inputStyle}
            >
              <option value="">Select academic year</option>

              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>

          {/* Term */}
          <div>
            <label style={labelStyle}>Term</label>

            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select term</option>

              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>

          {/* Programme */}
          <div>
            <label style={labelStyle}>Programme</label>

            <select
              value={programmeId}
              onChange={(e) => {
                setProgrammeId(e.target.value);
                setClassId('');
                setStudents([]);
                setScores([]);
              }}
              style={inputStyle}
            >
              <option value="">Select programme</option>

              {programmes.map((programme) => (
                <option
                  key={programme.id}
                  value={programme.id}
                >
                  {programme.name}
                  {programme.code
                    ? ` (${programme.code})`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label style={labelStyle}>Class</label>

            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select class</option>

              {filteredClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.level ? ` — ${item.level}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label style={labelStyle}>Subject</label>

            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select subject</option>

              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                  {subject.code
                    ? ` (${subject.code})`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment Type */}
          <div>
            <label style={labelStyle}>
              Assessment Type
            </label>

            <select
              value={assessmentType}
              onChange={(e) =>
                setAssessmentType(e.target.value)
              }
              style={inputStyle}
            >
              <option value="CA1">CA1</option>
              <option value="CA2">CA2</option>
              <option value="CA3">CA3</option>
              <option value="Exam">Exam</option>
            </select>
          </div>

          {/* Maximum Score */}
          <div>
            <label style={labelStyle}>
              Maximum Score
            </label>

            <input
              type="number"
              min="1"
              value={maxScore}
              onChange={(e) =>
                setMaxScore(e.target.value)
              }
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            background: message.startsWith('Error')
              ? '#fef2f2'
              : '#f0fdf4',
            color: message.startsWith('Error')
              ? '#b91c1c'
              : '#166534',
            fontSize: 14,
          }}
        >
          {message}
        </div>
      )}

      {/* Student Score Sheet */}
      {classId && (
        <form onSubmit={handleSaveAll}>
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Class Score Sheet
                </h2>

                <p
                  style={{
                    margin: '4px 0 0',
                    color: '#666',
                    fontSize: 13,
                  }}
                >
                  {students.length} active student
                  {students.length === 1 ? '' : 's'}
                </p>
              </div>

              {students.length > 0 && (
                <button
                  type="button"
                  onClick={() => fillAllScores('')}
                >
                  Clear scores
                </button>
              )}
            </div>

            {loadingStudents ? (
              <p
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: '#666',
                }}
              >
                Loading students…
              </p>
            ) : students.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: '#666',
                }}
              >
                No students are enrolled in this class for
                the selected academic year.
              </div>
            ) : (
              <>
                {/* Quick fill */}
                <div
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: '#666',
                    }}
                  >
                    Quick fill:
                  </span>

                  {[0, 5, 10, 15, 20, 25, 30].map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          fillAllScores(
                            String(
                              Math.min(
                                value,
                                Number(maxScore) || value
                              )
                            )
                          )
                        }
                        style={{
                          padding: '5px 9px',
                          fontSize: 12,
                        }}
                      >
                        {value}
                      </button>
                    )
                  )}
                </div>

                {/* Desktop/tablet score table */}
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: 650,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#f8fafc',
                        }}
                      >
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>
                          Student
                        </th>
                        <th style={thStyle}>
                          Admission No.
                        </th>
                        <th style={thStyle}>
                          Score / {maxScore || '—'}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {students.map((student, index) => {
                        const scoreEntry = scores.find(
                          (entry) =>
                            entry.student_id ===
                            student.id
                        );

                        return (
                          <tr key={student.id}>
                            <td style={tdStyle}>
                              {index + 1}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                fontWeight: 500,
                              }}
                            >
                              {student.full_name}
                            </td>

                            <td style={tdStyle}>
                              {student.admission_number}
                            </td>

                            <td style={tdStyle}>
                              <input
                                type="number"
                                min="0"
                                max={
                                  Number(maxScore) || undefined
                                }
                                step="0.01"
                                value={
                                  scoreEntry?.score ?? ''
                                }
                                onChange={(e) =>
                                  updateScore(
                                    student.id,
                                    e.target.value
                                  )
                                }
                                placeholder="Enter score"
                                style={{
                                  width: 130,
                                  padding: 9,
                                  border:
                                    '1px solid #d1d5db',
                                  borderRadius: 6,
                                  fontSize: 14,
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '11px 20px',
                      fontWeight: 600,
                    }}
                  >
                    {saving
                      ? 'Saving scores…'
                      : 'Save All Scores'}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      )}

      {/* Recent Scores */}
      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Recent Scores
        </h2>

        {records.length === 0 ? (
          <p style={{ color: '#666' }}>
            No scores recorded yet.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {records.map((record) => (
              <div
                key={record.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  background: 'white',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {studentName(record.student_id)}
                  </p>

                  <p
                    style={{
                      margin: '3px 0 0',
                      fontSize: 13,
                      color: '#666',
                    }}
                  >
                    {record.subject} ·{' '}
                    {record.assessment_type}
                    {record.term
                      ? ` · ${record.term}`
                      : ''}
                  </p>
                </div>

                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {record.score}/{record.max_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#4b5563',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 11px',
  border: '1px solid #d1d5db',
  borderRadius: 7,
  background: 'white',
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 12,
  fontSize: 13,
  fontWeight: 600,
  color: '#4b5563',
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 14,
  borderBottom: '1px solid #f0f0f0',
};
