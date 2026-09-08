import AcademicManager from '@/components/academic-manager';

export default function SubjectsPage() {
  return (
    <AcademicManager
      table="subjects"
      title="Subjects"
      description="Create and manage subjects taught in the school."
      icon="📚"
      fields={[
        {
          name: 'name',
          label: 'Subject Name',
          placeholder: 'e.g. Integrated Science',
        },
        {
          name: 'code',
          label: 'Subject Code',
          placeholder: 'e.g. SCI101',
        },
      ]}
      columns={['name', 'code']}
    />
  );
}
