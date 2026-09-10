import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import RightPanel from './components/RightPanel';
import ConnectMCPModal from './components/ConnectMCPModal';

function App() {
  const { selectedServerId, isConnectModalOpen, mcpServers } = useStore();
  const selectedServer = mcpServers.find(s => s.id === selectedServerId);

  return (
    <div className="app-container">
      <Sidebar />
      <ChatArea />
      {selectedServer && <RightPanel server={selectedServer} />}
      {isConnectModalOpen && <ConnectMCPModal />}
    </div>
  );
}

export default App;
