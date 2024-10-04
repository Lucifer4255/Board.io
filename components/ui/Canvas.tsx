import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

interface CanvasProps {
  color: string;
  size: number;
}

export interface CanvasHandle {
  getContext: () => CanvasRenderingContext2D | null;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ color, size }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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
      context.strokeStyle = 'white';  // Set brush color
      context.lineWidth = 5;  // Set brush size
      contextRef.current = context;
    }
  }, [color, size]);

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
