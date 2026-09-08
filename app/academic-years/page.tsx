import AcademicManager from '@/components/academic-manager';

export default function AcademicYearsPage() {
  return (
    <AcademicManager
      table="academic_years"
      title="Academic Years"
      description="Manage school academic years."
      icon="📅"
      fields={[
        {
          name: 'name',
          label: 'Academic Year',
          placeholder: 'e.g. 2026/2027',
        },
        {
          name: 'start_date',
          label: 'Start Date',
          type: 'date',
        },
        {
          name: 'end_date',
          label: 'End Date',
          type: 'date',
        },
      ]}
      columns={['name', 'start_date', 'end_date', 'is_current']}
    />
  );
}
