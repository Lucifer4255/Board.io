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
  useImperativeHandle(ref, () => ({
    getContext() {
      return canvasRef.current ? canvasRef.current.getContext('2d') : null;
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth * 2;
    canvas.height = window.innerHeight * 2;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const context = canvas.getContext('2d');
    if (context) {
      context.scale(2, 2);  // High resolution scaling
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
  };

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
