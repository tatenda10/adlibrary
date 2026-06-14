import { ArticleWorkspace } from '../components/ArticleWorkspace.jsx';
import { AdminPageHeader } from '../components/ui/AdminUi.jsx';

export function ArticlesAllPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title="All articles"
        description="Review, edit, and delete published or draft posts. Published items appear on the public blog."
      />
      <ArticleWorkspace mode="all" />
    </section>
  );
}
