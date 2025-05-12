import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDrawingContext } from '@/context/DrawingContext';
export interface CanvasHandle {
  getContext: () => CanvasRenderingContext2D | null;
}

const Canvas = forwardRef<CanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const {color, size , isEraser} = useDrawingContext();

  const [history, setHistory] = useState<string[]>([]);  // Store canvas snapshots
  const [historyIndex, setHistoryIndex] = useState<number>(-1);  // Track current history position


  useImperativeHandle(ref, () => ({
    getContext() {
      return canvasRef.current ? canvasRef.current.getContext('2d') : null;
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
    if(contextRef.current){
      contextRef.current.strokeStyle = isEraser ? '#09090B' : color;
      contextRef.current.lineWidth = size;
    }
  }, [color, size , isEraser]);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const snapshot = canvas.toDataURL();
      // Keep only history up to the current point, then add new state
      const newHistory = [...history.slice(0, historyIndex + 1), snapshot];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };


  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current?.lineTo(offsetX, offsetY);
    contextRef.current?.stroke();
  };

  const stopDrawing = () => {
    contextRef.current?.closePath();
    setIsDrawing(false);
    saveCanvasState();
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
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      style={{ border: '1px solid #000' }}
    />
  );
});
Canvas.displayName = 'Canvas';
export default Canvas;
