import React, { useState, useRef, useEffect } from "react";
import { Mic, Play, Pause, Square, Settings } from "lucide-react";
import { useSocket } from "./socket-provider";

type RecordingState = "idle" | "recording" | "paused";
type RecordingMode = "websocket" | "buffers" | "rest";

interface AudioRecorderProps {}

const AudioRecorder: React.FC<AudioRecorderProps> = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedMode, setSelectedMode] = useState<RecordingMode | null>(null);
  const [transcription, setTranscription] = useState("");
  const [duration, setDuration] = useState(0);
  const ws = useSocket();
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const bufferIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (bufferIntervalRef.current) clearInterval(bufferIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  useEffect(() => {
    if (!ws) return;
    ws.onmessage = (event) => {
      if (event.data) {
        const data = JSON.parse(event?.data ?? {});
        console.log(data);
      } else {
        console.log(event);
      }
    };
  }, [ws]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleModeSelect = async (mode: RecordingMode) => {
    setSelectedMode(mode);
    setShowModeModal(false);
    await startRecording(mode);
  };

  const startRecording = async (mode: RecordingMode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm; codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);

          if (mode === "websocket") {
            // Simulate WebSocket streaming
            simulateWebSocketTranscription(event.data);
          }
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        if (mode === "rest") {
          simulateRESTTranscription(audioBlob);
        }
      };

      if (mode === "buffers") {
        // Start recording with 5-second intervals
        mediaRecorder.start();
        bufferIntervalRef.current = setInterval(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            setTimeout(() => {
              if (streamRef.current && recordingState === "recording") {
                const newRecorder = new MediaRecorder(streamRef.current);
                mediaRecorderRef.current = newRecorder;
                audioChunksRef.current = [];

                newRecorder.ondataavailable = mediaRecorder.ondataavailable;
                newRecorder.onstop = () => {
                  const audioBlob = new Blob(audioChunksRef.current, {
                    type: "audio/webm",
                  });
                  simulateBufferTranscription(audioBlob);
                };

                newRecorder.start();
              }
            }, 100);
          }
        }, 5000);
      } else {
        if (mode == "websocket") {
          mediaRecorder?.start(100);
        } else {
          mediaRecorder.start(3000);
        }
      }

      setRecordingState("recording");
      setDuration(0);
      startTimer();
      setTranscription("");
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Unable to access microphone. Please check permissions.");
    }
  };

  const simulateWebSocketTranscription = (audioData: Blob) => {
    if (ws?.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not open. Unable to send audio data.");
      return;
    }
    console.log("Sending audio chunk over WebSocket:", audioData);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && ws?.readyState === WebSocket.OPEN) {
        ws.send(reader.result);
      }
    };
    reader.readAsArrayBuffer(audioData);
  };

  const simulateBufferTranscription = (audioBlob: Blob) => {};

  const simulateRESTTranscription = (audioBlob: Blob) => {};

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (bufferIntervalRef.current) {
      clearInterval(bufferIntervalRef.current);
      bufferIntervalRef.current = null;
    }

    stopTimer();

    setRecordingState("idle");
    setSelectedMode(null);
  };

  const pauseRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      stopTimer();
      setRecordingState("paused");
    }
  };

  const resumeRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      startTimer();
      setRecordingState("recording");
    }
  };

  const handleMainButton = () => {
    if (recordingState === "idle") {
      setShowModeModal(true);
    } else if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "paused") {
      resumeRecording();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Audio Recorder</h1>
          <p className="text-blue-200">
            Professional audio recording with real-time transcription
          </p>
        </div>

        {/* Main Recording Interface */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-6 border border-white/20">
          <div className="text-center mb-8">
            {/* Timer */}
            {/* <div className="text-6xl font-mono text-white mb-4">
              {formatDuration(duration)}
            </div> */}

            {/* Status */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div
                className={`w-3 h-3 rounded-full ${
                  recordingState === "recording"
                    ? "bg-red-500 animate-pulse"
                    : recordingState === "paused"
                    ? "bg-yellow-500"
                    : "bg-gray-400"
                }`}
              ></div>
              <span className="text-white capitalize font-medium">
                {recordingState === "idle"
                  ? "Ready to record"
                  : recordingState === "recording"
                  ? `Recording via ${selectedMode}`
                  : "Paused"}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-4">
              {/* Main Button */}
              <button
                onClick={handleMainButton}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl transition-all duration-200 transform hover:scale-110 ${
                  recordingState === "idle"
                    ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30"
                    : recordingState === "recording"
                    ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30"
                    : "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/30"
                }`}
              >
                {recordingState === "idle" ? (
                  <Mic />
                ) : recordingState === "recording" ? (
                  <Square />
                ) : (
                  <Play />
                )}
              </button>

              {/* Pause Button */}
              {recordingState === "recording" && (
                <button
                  onClick={pauseRecording}
                  className="w-16 h-16 bg-yellow-500 hover:bg-yellow-600 rounded-full flex items-center justify-center text-white text-xl transition-all duration-200 transform hover:scale-110 shadow-lg shadow-yellow-500/30"
                >
                  <Pause />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Transcription Display */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="text-blue-300" size={24} />
            <h2 className="text-2xl font-semibold text-white">
              Live Transcription
            </h2>
            {isProcessing && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            )}
          </div>

          <div className="bg-black/20 rounded-2xl p-6 min-h-[200px] border border-white/10">
            {transcription ? (
              <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                {transcription}
              </p>
            ) : (
              <p className="text-gray-400 text-lg italic">
                Transcription will appear here once recording starts...
              </p>
            )}
          </div>
        </div>

        {/* Mode Selection Modal */}
        {showModeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full border border-white/20">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Select Recording Mode
              </h3>

              <div className="space-y-4">
                <button
                  onClick={() => handleModeSelect("websocket")}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02] group"
                >
                  <div className="text-blue-300 font-semibold mb-2 group-hover:text-blue-200">
                    WebSocket Streaming
                  </div>
                  <div className="text-gray-300 text-sm">
                    Real-time audio streaming with live transcription
                  </div>
                </button>

                <button
                  onClick={() => handleModeSelect("buffers")}
                  className="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02] group"
                >
                  <div className="text-green-300 font-semibold mb-2 group-hover:text-green-200">
                    5-Second Buffer
                  </div>
                  <div className="text-gray-300 text-sm">
                    Process audio in 5-second chunks for better accuracy
                  </div>
                </button>

                <button
                  onClick={() => handleModeSelect("rest")}
                  className="w-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02] group"
                >
                  <div className="text-purple-300 font-semibold mb-2 group-hover:text-purple-200">
                    REST API
                  </div>
                  <div className="text-gray-300 text-sm">
                    Send audio packets with using REST api
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowModeModal(false)}
                className="w-full mt-6 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-400/30 rounded-2xl p-3 text-white transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
