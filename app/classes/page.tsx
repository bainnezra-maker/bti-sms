'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSchool,
  faPlus,
  faPenToSquare,
  faTrashCan,
  faMagnifyingGlass,
  faFloppyDisk,
  faXmark,
  faSpinner,
  faTriangleExclamation,
  faCircleCheck,
  faCalendarDays,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';

type AcademicYear = {
  id: string;
  name: string;
};

type Programme = {
  id: string;
  name: string;
};

type ClassRecord = {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
  academic_year_id: string | null;
  programme_id: string | null;
  academic_year?: AcademicYear | null;
  programme?: Programme | null;
};

export default function ClassesPage() {
  const supabase = createClient();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);

  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [programmeId, setProgrammeId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // --------------------------------------------------
  // NORMALIZE CLASS DATA
  // Supabase may return relationships as arrays.
  // We convert them into single objects for the UI.
  // --------------------------------------------------

  const normalizeClass = (item: any): ClassRecord => ({
    id: item.id,
    school_id: item.school_id,
    name: item.name,
    level: item.level ?? null,
    academic_year_id: item.academic_year_id ?? null,
    programme_id: item.programme_id ?? null,
    academic_year: Array.isArray(item.academic_year)
      ? item.academic_year[0] || null
      : item.academic_year || null,
    programme: Array.isArray(item.programme)
      ? item.programme[0] || null
      : item.programme || null,
  });

  // --------------------------------------------------
  // GET SCHOOL ID
  // --------------------------------------------------

  const getSchoolId = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('You must be logged in.');
    }

    const { data, error } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error('Unable to determine your school.');
    }

    if (!data?.school_id) {
      throw new Error('Your account is not linked to a school.');
    }

    return data.school_id as string;
  };

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const schoolId = await getSchoolId();

      const [
        { data: classData, error: classError },
        { data: yearData, error: yearError },
        { data: programmeData, error: programmeError },
      ] = await Promise.all([
        supabase
          .from('classes')
          .select(`
            id,
            school_id,
            name,
            level,
            academic_year_id,
            programme_id,
            academic_year:academic_years (
              id,
              name
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .eq('school_id', schoolId)
          .order('name', { ascending: true }),

        supabase
          .from('academic_years')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false }),

        supabase
          .from('programmes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: true }),
      ]);

      if (classError) {
        throw new Error(classError.message);
      }

      if (yearError) {
        throw new Error(yearError.message);
      }

      if (programmeError) {
        throw new Error(programmeError.message);
      }

      // FIX:
      // Normalize Supabase relationship arrays into objects.
      setClasses(
        (classData || []).map((item: any) => normalizeClass(item))
      );

      setAcademicYears((yearData || []) as AcademicYear[]);
      setProgrammes((programmeData || []) as Programme[]);
    } catch (err: any) {
      setError(err?.message || 'Unable to load classes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --------------------------------------------------
  // RESET FORM
  // --------------------------------------------------

  const resetForm = () => {
    setName('');
    setLevel('');
    setAcademicYearId('');
    setProgrammeId('');
    setEditingId(null);
  };

  // --------------------------------------------------
  // EDIT CLASS
  // --------------------------------------------------

  const editClass = (classItem: ClassRecord) => {
    setError('');
    setMessage('');

    setEditingId(classItem.id);
    setName(classItem.name);
    setLevel(classItem.level || '');
    setAcademicYearId(classItem.academic_year_id || '');
    setProgrammeId(classItem.programme_id || '');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // --------------------------------------------------
  // SAVE CLASS
  // --------------------------------------------------

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setMessage('');

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter a class name.');
      return;
    }

    if (!academicYearId) {
      setError('Please select an academic year.');
      return;
    }

    setSaving(true);

    try {
      const schoolId = await getSchoolId();

      const payload = {
        school_id: schoolId,
        name: trimmedName,
        level: level || null,
        academic_year_id: academicYearId,
        programme_id: programmeId || null,
      };

      // --------------------------------------------------
      // UPDATE CLASS
      // --------------------------------------------------

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)
          .select(`
            id,
            school_id,
            name,
            level,
            academic_year_id,
            programme_id,
            academic_year:academic_years (
              id,
              name
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (data) {
          const normalizedClass = normalizeClass(data);

          setClasses((current) =>
            current.map((item) =>
              item.id === editingId
                ? normalizedClass
                : item
            )
          );
        }

        setMessage('Class updated successfully.');
        resetForm();
      }

      // --------------------------------------------------
      // CREATE CLASS
      // --------------------------------------------------

      else {
        const { data, error: insertError } = await supabase
          .from('classes')
          .insert(payload)
          .select(`
            id,
            school_id,
            name,
            level,
            academic_year_id,
            programme_id,
            academic_year:academic_years (
              id,
              name
            ),
            programme:programmes (
              id,
              name
            )
          `)
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        if (data) {
          const normalizedClass = normalizeClass(data);

          setClasses((current) =>
            [...current, normalizedClass].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
          );
        }

        setMessage('Class created successfully.');
        resetForm();
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to save class.');
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // DELETE CLASS
  // --------------------------------------------------

  const deleteClass = async (classItem: ClassRecord) => {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${classItem.name}"?\n\n` +
        `This action cannot be undone.`
    );

    if (!confirmed) return;

    setError('');
    setMessage('');
    setDeletingId(classItem.id);

    try {
      const schoolId = await getSchoolId();

      // --------------------------------------------------
      // CHECK ENROLLMENTS
      // --------------------------------------------------

      const {
        count: enrollmentCount,
        error: enrollmentError,
      } = await supabase
        .from('enrollments')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('class_id', classItem.id);

      if (enrollmentError) {
        throw new Error(
          `Unable to check student enrollments: ${enrollmentError.message}`
        );
      }

      // --------------------------------------------------
      // CHECK TEACHER ASSIGNMENTS
      // --------------------------------------------------

      const {
        count: teacherAssignmentCount,
        error: teacherAssignmentError,
      } = await supabase
        .from('teacher_assignments')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('class_id', classItem.id);

      if (teacherAssignmentError) {
        throw new Error(
          `Unable to check teacher assignments: ${teacherAssignmentError.message}`
        );
      }

      // --------------------------------------------------
      // DON'T DELETE A CLASS THAT IS IN USE
      // --------------------------------------------------

      const studentsUsingClass = enrollmentCount || 0;
      const teachersUsingClass = teacherAssignmentCount || 0;

      if (studentsUsingClass > 0 || teachersUsingClass > 0) {
        const details: string[] = [];

        if (studentsUsingClass > 0) {
          details.push(
            `${studentsUsingClass} student enrollment${
              studentsUsingClass === 1 ? '' : 's'
            }`
          );
        }

        if (teachersUsingClass > 0) {
          details.push(
            `${teachersUsingClass} teacher assignment${
              teachersUsingClass === 1 ? '' : 's'
            }`
          );
        }

        throw new Error(
          `This class cannot be deleted because it is currently in use by ${details.join(
            ' and '
          )}. Remove the related records first.`
        );
      }

      // --------------------------------------------------
      // DELETE CLASS
      // --------------------------------------------------

      const { error: deleteError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classItem.id)
        .eq('school_id', schoolId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Remove from visible list
      setClasses((current) =>
        current.filter((item) => item.id !== classItem.id)
      );

      // If user was editing this class, reset the form
      if (editingId === classItem.id) {
        resetForm();
      }

      setMessage(`"${classItem.name}" was deleted successfully.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to delete class.');
    } finally {
      setDeletingId(null);
    }
  };

  // --------------------------------------------------
  // FILTER CLASSES
  // --------------------------------------------------

  const filteredClasses = classes.filter((item) => {
    const query = search.toLowerCase().trim();

    if (!query) return true;

    return (
      item.name.toLowerCase().includes(query) ||
      (item.level || '').toLowerCase().includes(query) ||
      (item.programme?.name || '').toLowerCase().includes(query) ||
      (item.academic_year?.name || '').toLowerCase().includes(query)
    );
  });

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
            <FontAwesomeIcon
              icon={faSchool}
              className="text-blue-600 transition-transform duration-300 hover:scale-110 hover:rotate-6"
            />
            Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your school classes, academic years and programmes.
          </p>
        </div>

        <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {classes.length} {classes.length === 1 ? 'Class' : 'Classes'}
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mt-0.5 shrink-0 animate-pulse"
          />

          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {message && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <FontAwesomeIcon
            icon={faCircleCheck}
            className="mt-0.5 shrink-0 transition-transform duration-300 hover:scale-110"
          />

          <span>{message}</span>
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={saveClass}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="mb-5 flex items-center gap-2">
          <FontAwesomeIcon
            icon={editingId ? faPenToSquare : faPlus}
            className="text-blue-600 transition-transform duration-300 hover:scale-110"
          />

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingId ? 'Edit Class' : 'Add Class'}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* CLASS NAME */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <FontAwesomeIcon icon={faSchool} className="text-gray-400" />
              Class Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A, B, 1A, 2B"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* LEVEL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Level / Form
            </label>

            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="e.g. Form 1"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* ACADEMIC YEAR */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <FontAwesomeIcon
                icon={faCalendarDays}
                className="text-gray-400"
              />
              Academic Year
            </label>

            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select academic year</option>

              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>

          {/* PROGRAMME */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <FontAwesomeIcon
                icon={faLayerGroup}
                className="text-gray-400"
              />
              Programme
            </label>

            <select
              value={programmeId}
              onChange={(e) => setProgrammeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select programme</option>

              {programmes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* FORM BUTTONS */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FontAwesomeIcon
              icon={
                saving
                  ? faSpinner
                  : editingId
                  ? faFloppyDisk
                  : faPlus
              }
              className={
                saving
                  ? 'animate-spin'
                  : 'transition-transform duration-200'
              }
            />

            {saving
              ? 'Saving...'
              : editingId
              ? 'Save Changes'
              : 'Add Class'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <FontAwesomeIcon
                icon={faXmark}
                className="transition-transform duration-200 hover:rotate-90"
              />

              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* SEARCH */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform duration-200"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes, levels, programmes or academic years..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* CLASS LIST */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
              <FontAwesomeIcon
                icon={faSpinner}
                className="text-3xl text-blue-600 animate-spin"
              />

              <span className="text-sm">Loading classes...</span>
            </div>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
            <FontAwesomeIcon
              icon={faSchool}
              className="mb-4 text-4xl text-gray-300 transition-transform duration-300 hover:scale-110 dark:text-gray-600"
            />

            <h3 className="font-semibold text-gray-700 dark:text-gray-200">
              {search ? 'No classes found' : 'No classes yet'}
            </h3>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {search
                ? 'Try a different search term.'
                : 'Add your first class using the form above.'}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Class</th>
                    <th className="px-5 py-3">Level</th>
                    <th className="px-5 py-3">Programme</th>
                    <th className="px-5 py-3">Academic Year</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredClasses.map((classItem) => (
                    <tr
                      key={classItem.id}
                      className="transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={faSchool}
                            className="text-blue-500 transition-transform duration-200 hover:scale-110"
                          />
                          {classItem.name}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {classItem.level || '—'}
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {classItem.programme?.name || '—'}
                      </td>

                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {classItem.academic_year?.name || '—'}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editClass(classItem)}
                            disabled={deletingId === classItem.id}
                            title="Edit class"
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all duration-200 hover:scale-105 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                          >
                            <FontAwesomeIcon
                              icon={faPenToSquare}
                              className="transition-transform duration-200 hover:rotate-6"
                            />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteClass(classItem)}
                            disabled={deletingId === classItem.id}
                            title="Delete class"
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-all duration-200 hover:scale-105 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                          >
                            <FontAwesomeIcon
                              icon={
                                deletingId === classItem.id
                                  ? faSpinner
                                  : faTrashCan
                              }
                              className={
                                deletingId === classItem.id
                                  ? 'animate-spin'
                                  : 'transition-transform duration-200 hover:rotate-12'
                              }
                            />

                            {deletingId === classItem.id
                              ? 'Deleting...'
                              : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
              {filteredClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  className="p-4 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                        <FontAwesomeIcon
                          icon={faSchool}
                          className="text-blue-500"
                        />
                        {classItem.name}
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <p>
                          <span className="font-medium">Level:</span>{' '}
                          {classItem.level || '—'}
                        </p>

                        <p>
                          <span className="font-medium">Programme:</span>{' '}
                          {classItem.programme?.name || '—'}
                        </p>

                        <p>
                          <span className="font-medium">
                            Academic Year:
                          </span>{' '}
                          {classItem.academic_year?.name || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => editClass(classItem)}
                      disabled={deletingId === classItem.id}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 transition-all duration-200 hover:scale-[1.02] hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteClass(classItem)}
                      disabled={deletingId === classItem.id}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 transition-all duration-200 hover:scale-[1.02] hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                    >
                      <FontAwesomeIcon
                        icon={
                          deletingId === classItem.id
                            ? faSpinner
                            : faTrashCan
                        }
                        className={
                          deletingId === classItem.id
                            ? 'animate-spin'
                            : ''
                        }
                      />

                      {deletingId === classItem.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
