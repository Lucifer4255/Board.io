import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDrawingContext } from '@/context/DrawingContext';

export interface CanvasHandle {
  getContext: () => CanvasRenderingContext2D | null;
  getStrokes: () => [number, number][][];
  clearStrokes: () => void;
}

const Canvas = forwardRef<CanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { color, size, isEraser } = useDrawingContext();
  const isEraserRef = useRef(isEraser);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Stroke tracking for recognition (not tied to render cycle)
  const strokesRef = useRef<[number, number][][]>([]);
  const currentStrokeRef = useRef<[number, number][]>([]);
  const pointIndexRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getContext() {
      return canvasRef.current ? canvasRef.current.getContext('2d') : null;
    },
    getStrokes() {
      return strokesRef.current;
    },
    clearStrokes() {
      strokesRef.current = [];
      currentStrokeRef.current = [];
      pointIndexRef.current = 0;
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const context = canvas.getContext('2d');
    if (context) {
      context.scale(scale, scale);  // High resolution scaling
      context.lineCap = 'round';  // Smooth lines
      context.strokeStyle = color;  // Set brush color
      context.lineWidth = size;  // Set brush size
      contextRef.current = context;
    }
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = isEraser ? '#09090B' : color;
      contextRef.current.lineWidth = size;
      isEraserRef.current = isEraser;
    }
  }, [color, size, isEraser]);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const snapshot = canvas.toDataURL();
      const newHistory = [...history.slice(0, historyIndex + 1), snapshot];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    if (!isEraserRef.current) {
      currentStrokeRef.current = [[offsetX, offsetY]];
      pointIndexRef.current = 1;
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current?.lineTo(offsetX, offsetY);
    contextRef.current?.stroke();
    if (!isEraserRef.current) {
      pointIndexRef.current += 1;
      // keep every 2nd point to reduce payload
      if (pointIndexRef.current % 2 === 0) {
        currentStrokeRef.current.push([offsetX, offsetY]);
      }
    }
  };

  const stopDrawing = () => {
    contextRef.current?.closePath();
    setIsDrawing(false);
    saveCanvasState();
    if (!isEraserRef.current && currentStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
      currentStrokeRef.current = [];
      pointIndexRef.current = 0;
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevImage = history[historyIndex - 1];
      restoreCanvas(prevImage);
      setHistoryIndex(historyIndex - 1);
    }
  };

  // Redo: move one step forward in history and restore canvas state
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextImage = history[historyIndex + 1];
      restoreCanvas(nextImage);
      setHistoryIndex(historyIndex + 1);
    }
  };
  
  // Restore canvas from a base64 image
  const restoreCanvas = (imageData: string) => {
  const canvas = canvasRef.current;
  if (canvas) {
    const context = canvas.getContext('2d');
    const img = new Image();
    img.src = imageData;
    img.onload = () => {
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas
        // Draw the image onto the canvas, matching the canvas size
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
  }
};

  // Keydown event listener for undo/redo shortcuts
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      if (event.shiftKey) {
        // Ctrl + Shift + Z -> Redo
        handleRedo();
      } else {
        // Ctrl + Z -> Undo
        handleUndo();
      }
      event.preventDefault();  // Prevent default browser behavior for shortcuts
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
      // Ctrl + Y -> Redo
      handleRedo();
      event.preventDefault();
    }
  };

  // Attach keydown listener when component mounts
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyIndex, history]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={stopDrawing}
      onPointerLeave={stopDrawing}
      style={{ border: '1px solid #000', touchAction: 'none' }}
    />
  );
});
Canvas.displayName = 'Canvas';
export default Canvas;
