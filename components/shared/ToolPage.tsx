import PageTitle from "./PageTitle";

/**
 * Shared frame for every tool page, so they all have the same width, title
 * size and spacing. Change the width here, not per page.
 */
export default function ToolPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageTitle title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}
