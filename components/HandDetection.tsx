"use client";

import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { Pencil, Hand, Video, VideoOff } from "lucide-react";

interface HandDetectionProps {
  width?: number;
  height?: number;
  maxHands?: number;
}

interface Point {
  x: number;
  y: number;
}

const DEFAULT_CONFIG = {
  width: 1000,
  height: 1000,
  maxHands: 2,
};

const INDEX_FINGER_TIP = 8;
const THUMB_TIP = 4;
const PINCH_THRESHOLD = 0.03;
const PINCH_COOLDOWN = 300;
const SMOOTHING_FACTOR = 0.4;
const POINT_MEMORY = 2;

const HandDetection: React.FC<HandDetectionProps> = ({
  width = DEFAULT_CONFIG.width,
  height = DEFAULT_CONFIG.height,
  maxHands = DEFAULT_CONFIG.maxHands,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [start, setStart] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [isPenEnabled, setIsPenEnabled] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const isDragEnabledRef = useRef(false);
  const isPenEnabledRef = useRef(false);
  const previousPositionRef = useRef<Point | null>(null);
  const lastPinchTimeRef = useRef<number>(0);
  const isPinchedRef = useRef<boolean>(false);
  const pointHistoryRef = useRef<Point[]>([]);

  useEffect(() => {
    isPenEnabledRef.current = isPenEnabled;
    isDragEnabledRef.current = isDragEnabled;
  }, [isPenEnabled, isDragEnabled]);

  const clearCanvas = () => {
    const drawingCanvas = drawingCanvasRef.current;
    if (drawingCanvas) {
      const ctx = drawingCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
    }
    pointHistoryRef.current = [];
    previousPositionRef.current = null;
  };

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const initializeHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          numHands: maxHands,
          runningMode: "VIDEO",
        });

        handLandmarkerRef.current = handLandmarker;
        setIsLoading(false);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width, height },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
       
        startDetection();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        setIsLoading(false);
        console.error("Hand detection setup error:", errorMessage);
      }
    };

    const startDetection = () => {
      const detectFrame = async () => {
        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        const drawingCanvasElement = drawingCanvasRef.current;
        const handLandmarker = handLandmarkerRef.current;

        if (!videoElement || !canvasElement || !handLandmarker || !drawingCanvasElement)
          return;

        const startTimeMs = performance.now();
        const results = handLandmarker.detectForVideo(videoElement, startTimeMs);

        if (drawMode) {
          checkPinchGesture(results);
          if (isPenEnabledRef.current) {
            drawOnSheet(results);
          } else {
            previousPositionRef.current = null;
            pointHistoryRef.current = [];
          }
        }
        
        drawResults(results);
        animationFrameId = requestAnimationFrame(detectFrame);
      };

      detectFrame();
    };

    if (start) {
      initializeHandLandmarker();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
    };
  }, [width, height, maxHands, start, drawMode]);

  const smoothPoint = (currentPoint: Point): Point => {
    const points = pointHistoryRef.current;
    points.push(currentPoint);
    
    if (points.length > POINT_MEMORY) {
      points.shift();
    }

    if (points.length < 2) return currentPoint;

    let smoothX = 0;
    let smoothY = 0;

    const totalWeight = points.reduce((sum, _, index) => sum + (index + 1), 0);

    points.forEach((point, index) => {
      const weight = (index + 1) / totalWeight;
      smoothX += point.x * weight;
      smoothY += point.y * weight;
    });

    return {
      x: currentPoint.x * (1 - SMOOTHING_FACTOR) + smoothX * SMOOTHING_FACTOR,
      y: currentPoint.y * (1 - SMOOTHING_FACTOR) + smoothY * SMOOTHING_FACTOR
    };
  };

  const checkPinchGesture = (results: HandLandmarkerResult) => {
    if (!results.landmarks?.[0]) {
      isPinchedRef.current = false;
      return;
    }

    const landmarks = results.landmarks[0];
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_FINGER_TIP];

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    const isPinched = distance < PINCH_THRESHOLD;
    const currentTime = Date.now();

    if (isPinched && 
        !isPinchedRef.current && 
        currentTime - lastPinchTimeRef.current > PINCH_COOLDOWN) {
      setIsPenEnabled(prev => !prev);
      setIsDragEnabled(prev => !prev);
      lastPinchTimeRef.current = currentTime;
    }

    isPinchedRef.current = isPinched;
  };

  const drawResults = (results: HandLandmarkerResult) => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks) {
      results.landmarks.forEach((landmarks) => {
        landmarks.forEach((landmark, index) => {
          const x = landmark.x * canvasElement.width;
          const y = landmark.y * canvasElement.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = (index === THUMB_TIP || index === INDEX_FINGER_TIP) 
            ? 'rgba(255, 0, 0, 0.7)' 
            : 'rgba(0, 255, 0, 0.7)';
          ctx.fill();
        });
      });
    }
  };

  const drawOnSheet = (results: HandLandmarkerResult) => {
    const drawingCanvasElement = drawingCanvasRef.current;
    if (!drawingCanvasElement || !results.landmarks?.[0]) return;

    const ctx = drawingCanvasElement.getContext("2d");
    if (!ctx) return;

    const indexTip = results.landmarks[0][INDEX_FINGER_TIP];
    const rawX = indexTip.x * drawingCanvasElement.width;
    const rawY = indexTip.y * drawingCanvasElement.height;

    const smoothedPoint = smoothPoint({ x: rawX, y: rawY });
    const previousPosition = previousPositionRef.current;

    if (previousPosition) {
      ctx.beginPath();
      ctx.moveTo(previousPosition.x, previousPosition.y);
      
      const controlX = (previousPosition.x + smoothedPoint.x) / 2;
      const controlY = (previousPosition.y + smoothedPoint.y) / 2;
      
      ctx.quadraticCurveTo(controlX, controlY, smoothedPoint.x, smoothedPoint.y);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    previousPositionRef.current = smoothedPoint;
  };

  return (
    <div className="w-full bg-gray-100 p-4">
      <div className="w-full">
        <div className="bg-white w-full rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">AirCanvas</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setStart(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                  start ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                } text-white transition-colors`}
              >
                {start ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                {start ? 'Stop Camera' : 'Start Camera'}
              </button>
              {start && (
                <button
                  onClick={() => {
                    setDrawMode(prev => !prev);
                    setIsPenEnabled(false);
                    setIsDragEnabled(false);
                    clearCanvas();
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                    drawMode ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-600'
                  } text-white transition-colors`}
                >
                  {drawMode ? <Hand className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
                  {drawMode ? 'Hand Detection Mode' : 'Drawing Mode'}
                </button>
              )}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex gap-4 mb-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                Error: {error}
              </div>
            )}
            {isLoading && start && (
              <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-2 rounded">
                Loading hand detection model...
              </div>
            )}
            {drawMode && (
              <div className={`px-4 py-2 rounded ${
                isDragEnabled ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-gray-100 border border-gray-400 text-gray-700'
              }`}>
                Drawing: {isDragEnabled ? 'Enabled' : 'Disabled'}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="h-[800px] w-full relative bg-gray-900 rounded-lg overflow-hidden">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>

</div>

            <video
              ref={videoRef}
              className="absolute bottom-0 right-0 w-1/5 h-1/5"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={drawingCanvasRef}
              width={width}
              height={height}
              className="absolute top-0 left-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Instructions:</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Click "Start Camera" to begin hand detection</li>
              <li>Switch to "Drawing Mode" to enable drawing features</li>
              <li>In drawing mode, pinch your thumb and index finger together to toggle drawing</li>
              <li>Move your index finger to draw when enabled</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandDetection;