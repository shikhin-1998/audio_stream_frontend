import "./App.css";
import AudioRecorder from "./Audio-record";
import { SocketProvider } from "./socket-provider";

function App() {
  return (
    <main>
      <SocketProvider>
        <AudioRecorder />
      </SocketProvider>
    </main>
  );
}

export default App;
