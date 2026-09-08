import AcademicManager from '@/components/academic-manager';

export default function ProgrammesPage() {
  return (
    <AcademicManager
      table="programmes"
      title="Programmes"
      description="Manage programmes and departments."
      icon="🧰"
      fields={[
        {
          name: 'name',
          label: 'Programme Name',
          placeholder: 'e.g. Electrical Engineering',
        },
        {
          name: 'code',
          label: 'Programme Code',
          placeholder: 'e.g. EET',
        },
      ]}
      columns={['name', 'code']}
    />
  );
}
