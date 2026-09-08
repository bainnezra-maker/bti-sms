import AcademicManager from '@/components/academic-manager';

export default function ClassesPage() {
  return (
    <AcademicManager
      table="classes"
      title="Classes"
      description="Create and manage school classes."
      icon="🏫"
      fields={[
        {
          name: 'name',
          label: 'Class Name',
          placeholder: 'e.g. 1A Electrical',
        },
        {
          name: 'level',
          label: 'Level',
          placeholder: 'e.g. Form 1',
        },
      ]}
      columns={['name', 'level']}
    />
  );
}
