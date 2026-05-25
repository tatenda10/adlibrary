import { ArticleWorkspace } from '../components/ArticleWorkspace.jsx';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

export function ArticlesAllPage() {
  const { admin } = useAdminAuth();

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">All Articles</h3>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Review, edit, and delete published or draft stories. Signed in as{' '}
          <span className="text-[#d1d5db]">{admin?.username}</span>.
        </p>
      </div>
      <ArticleWorkspace mode="all" />
    </section>
  );
}
