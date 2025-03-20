import { AuthChecker } from '../../components/auth';

function MainContent() {
  return (
    <div className="p-2 rounded-lg">
      <div className="flex">
        <div className="flex-1 p-2 text-center border rounded-l-lg">
          Discover
        </div>
        <div className="flex-1 p-2 text-center border rounded-r-lg">Chat</div>
      </div>

      <div className="mt-4">
        <div className="p-2">
          <h2 className="text-lg font-medium mb-2">Discover Content</h2>
          <p>Discover new conversations and connections here.</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="w-80 p-4">
      <h1 className="text-xl font-bold mb-4">Serengpty</h1>
      <AuthChecker>
        <MainContent />
      </AuthChecker>
    </div>
  );
}

export default App;
