import { ArticleWorkspace } from '../components/ArticleWorkspace.jsx';
import { AdminPageHeader } from '../components/ui/AdminUi.jsx';

export function ArticlesNewPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title="New article"
        description="Write with bullet points, add images, and publish when ready."
      />
      <ArticleWorkspace mode="new" />
    </section>
  );
}
