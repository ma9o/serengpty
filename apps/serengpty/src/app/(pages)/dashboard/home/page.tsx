import { getSerendipitousPaths } from '../../../actions/getSerendipitousPaths';
import { VerticalSerendipitousPaths } from '../../../components/serendipitous-paths/vertical-serendipitous-paths';

export default async function Page() {
  // Fetch data server-side
  let pathsData;
  let error;

  try {
    pathsData = await getSerendipitousPaths();
  } catch (err) {
    console.error('Error fetching serendipitous paths:', err);
    error =
      err instanceof Error ? err.message : 'Failed to load serendipitous paths';
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 rounded-xl bg-card overflow-hidden">
        <VerticalSerendipitousPaths
          initialData={pathsData}
          initialError={error}
        />
      </div>
    </div>
  );
}
