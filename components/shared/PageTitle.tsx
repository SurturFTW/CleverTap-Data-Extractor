export default function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-10 text-center">
      <h1 className="mb-3 text-4xl font-bold text-black">{title}</h1>
      <p className="text-lg text-gray-600">{subtitle}</p>
    </header>
  );
}
