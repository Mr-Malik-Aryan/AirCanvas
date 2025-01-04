"use client";

import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

interface HandDetectionProps {
  width?: number;
  height?: number;
  maxHands?: number;
}

const DEFAULT_CONFIG = {
  width: 1000,
  height: 1000,
  maxHands: 1,
};

const INDEX_FINGER_TIP = 8;
const THUMB_TIP = 4;
const PINCH_THRESHOLD = 0.03;
const PINCH_COOLDOWN = 500; // Milliseconds to wait before allowing another pinch

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
  const [isPenEnabled, setIsPenEnabled] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const isDragEnabledRef = useRef(false);
  const isPenEnabledRef = useRef(false); // Add this ref to track pen state
  const previousPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchTimeRef = useRef<number>(0);
  const isPinchedRef = useRef<boolean>(false);

  // Update ref when state changes
  useEffect(() => {
    isPenEnabledRef.current = isPenEnabled;
    isDragEnabledRef.current =isDragEnabled;
  }, [isPenEnabled,isDragEnabled]);

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

        checkPinchGesture(results);
       // console.log(results)
        drag(results)
        drawResults(results);
        if (isPenEnabledRef.current) { // Use ref instead of state
          drawOnSheet(results);
        } else {
          previousPositionRef.current = null;
        }

        animationFrameId = requestAnimationFrame(detectFrame);
      };

      detectFrame();
    };
     if (start)
    initializeHandLandmarker();


    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
    };
    
  }, [width, height, maxHands,start]); // Remove isPenEnabled from dependencies

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
      setIsDragEnabled(prev=>!prev);
      lastPinchTimeRef.current = currentTime;
    }

    isPinchedRef.current = isPinched;
  };
  const drag =(results:HandLandmarkerResult)=>{
    checkPinchGesture(results)

  }

  const drawResults = (results: HandLandmarkerResult) => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks) {
      results.landmarks.forEach((landmarks) => {
        landmarks.forEach((landmark, index) => {
          const x = canvasElement.width - (landmark.x * canvasElement.width);
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
 //code to draw
  const drawOnSheet = (results: HandLandmarkerResult) => {
    const drawingCanvasElement = drawingCanvasRef.current;
    if (!drawingCanvasElement || !results.landmarks) return;

    const ctx = drawingCanvasElement.getContext("2d");
    if (!ctx) return;

    results.landmarks.forEach((landmarkList) => {
      const indexTip = landmarkList[INDEX_FINGER_TIP];
      const x = drawingCanvasElement.width - (indexTip.x * drawingCanvasElement.width);
      const y = indexTip.y * drawingCanvasElement.height;

      const previousPosition = previousPositionRef.current;

      if (previousPosition) {
        ctx.beginPath();
        ctx.moveTo(previousPosition.x, previousPosition.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      previousPositionRef.current = { x, y };
    });
  };

  return (<>

    <div className="relative w-full h-full">
    <button  className=" absolute z-20 left-80 bg-green-400 ml-auto w-20 h-10" onClick={()=>{setStart(prev=>!prev);console.log(start)}}>Start</button>

      {error && (
        <div className="absolute top-0 left-0 bg-red-500 text-white p-2 rounded z-50">
          Error: {error}
        </div>
      )}
      {isLoading && (
        <div className="absolute top-0 left-0 bg-blue-500 text-white p-2 rounded z-50">
          Loading hand detection model...
        </div>
      )}
     {isDragEnabled&&( <div className="absolute top-0 left-1/2 bg-green-500 text-white p-2 rounded z-50">
        Pinch: {'Enabled'}
      </div>
     )}
        {!isDragEnabled&&( <div className="absolute top-0 left-1/2 bg-red-500 text-white p-2 rounded z-50">
        Pinch: {'Disabled'}
      </div>
     )}
      <div className="flex justify-center w-full h-screen">
        <video
          ref={videoRef}
          width="30%"
          height="50%"
          className="flex ml-auto mt-auto  rounded h-screen"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute top-0 left-0 pointer-events-none w-full h-screen" 
        />
        <canvas
          ref={drawingCanvasRef}
          width={width}
          height={height}
          className="absolute top-0 left-0 w-full h-screen" 
        />
      </div>
    </div>
    </>
  );
};

export default HandDetection;