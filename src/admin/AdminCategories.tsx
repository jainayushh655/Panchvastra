export function AdminCategories() {
  return (
    <div className="max-w-4xl">
      <h1 className="type-page-title text-white">Categories</h1>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="text-lg font-semibold text-white">
          Categories are managed from the Django Admin CMS.
        </p>

        <p className="mt-3 text-sm text-zinc-400">
          Create, update or delete categories in the Django Admin panel.
          The React storefront automatically loads the latest categories
          from the backend.
        </p>
      </div>
    </div>
  );
}