import { getSerendipitousPaths } from '../../../actions/getSerendipitousPaths';
import { VerticalSerendipitousPaths } from '../../../components/serendipitous-paths/vertical-serendipitous-paths';
import { UserProvider } from '../../../components/chat/UserContext';

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
        {/* Wrap with UserProvider to provide chat functionality */}
        <UserProvider>
          <VerticalSerendipitousPaths
            initialData={pathsData}
            initialError={error}
          />
        </UserProvider>
      </div>
    </div>
  );
}
