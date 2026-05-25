import { ArticleWorkspace } from '../components/ArticleWorkspace.jsx';

export function ArticlesNewPage() {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Add Article</h3>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Write with bullet points, add images, and publish when ready.
        </p>
      </div>
      <ArticleWorkspace mode="new" />
    </section>
  );
}
