import { getSerendipitousPaths } from '../../../actions/getSerendipitousPaths';
import { SerendipitousPathsCarousel } from '../../../components/serendipitous-paths/serendipitous-paths-carousel';

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
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 rounded-xl bg-card p-4">
        <SerendipitousPathsCarousel
          initialData={pathsData}
          initialError={error}
        />
      </div>
    </div>
  );
}
