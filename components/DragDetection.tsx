"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
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
const PINCH_COOLDOWN = 600;

const DragDetection: React.FC<HandDetectionProps> = ({
  width = DEFAULT_CONFIG.width,
  height = DEFAULT_CONFIG.height,
  maxHands = DEFAULT_CONFIG.maxHands,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [start, setStart] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [imagePosition, setImagePosition] = useState<Point>({ x: 300, y: 300 });
  const lastPinchTimeRef = useRef<number>(0);
  const isPinchedRef = useRef<boolean>(false);

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
        const handLandmarker = handLandmarkerRef.current;

        if (!videoElement || !handLandmarker) return;

        const startTimeMs = performance.now();
        const results = handLandmarker.detectForVideo(videoElement, startTimeMs);

        checkPinchGesture(results);
        if (isDragEnabled && isPinchedRef.current) {
          moveImage(results);
        }

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
  }, [width, height, maxHands, start, isDragEnabled]);

  const checkPinchGesture = (results: HandLandmarkerResult) => {
    if (!results.landmarks?.[0]) {
      isPinchedRef.current = false;
      return;
    }

    const landmarks = results.landmarks[0];
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_FINGER_TIP];

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
    );

    const isPinched = distance < PINCH_THRESHOLD;
    const currentTime = Date.now();

    if (isPinched && !isPinchedRef.current) {
      if (currentTime - lastPinchTimeRef.current > PINCH_COOLDOWN) {
        setIsDragEnabled((prev) => !prev);
        lastPinchTimeRef.current = currentTime;
      }
    }

    isPinchedRef.current = isPinched;
  };

  const moveImage = (results: HandLandmarkerResult) => {
    if (!results.landmarks?.[0]) return;

    const landmarks = results.landmarks[0];
    const indexTip = landmarks[INDEX_FINGER_TIP];

    const newImagePosition = {
      x: indexTip.x * width,
      y: indexTip.y * height,
    };

    setImagePosition(newImagePosition);
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
                onClick={() => setStart((prev) => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                  start ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                } text-white transition-colors`}
              >
                {start ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                {start ? "Stop Camera" : "Start Camera"}
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="h-[800px] w-full relative bg-gray-900 rounded-lg overflow-hidden">
            <img
              src="https://picsum.photos/500/300"
              alt="Random Image"
              draggable="false"
              style={{
                position: "absolute",
                top: `${imagePosition.y}px`,
                left: `${imagePosition.x}px`,
                cursor: isDragEnabled ? "grabbing" : "grab",
              }}
            />
            <video
              ref={videoRef}
              className="absolute bottom-0 right-0 w-1/5 h-1/5"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragDetection;
