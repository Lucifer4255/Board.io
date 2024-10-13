import React, { useState } from "react";
import { useDrawingContext } from "@/context/DrawingContext";
import clsx from "clsx";
import { Button } from "./button";
import { EraserIcon } from "@radix-ui/react-icons"
interface ToolbarProps {
  clearCanvas: () => void;
  sendCanvasData: () => void; // Function to send canvas data to server for processing.
}
const colors = ['#FF5733', '#33FF57', '#3357FF', '#FFFF33', '#FF33FF', '#333333', '#FFFFFF'];

export default function Toolbar({
  clearCanvas,
  sendCanvasData // Function to send canvas data to server for processing.
}: ToolbarProps) {
  const [currentColor, setCurrentColor] = useState(colors[0]);
  const { setColor, setSize,isEraser ,setIsEraser } = useDrawingContext(); // Get the drawing context from the context provider.
  const handleColorChange = (color :string) => {
    setCurrentColor(color);
    setColor(color);
    setIsEraser(false);
  };
  return (
    <div style={{ padding: '10px', display: 'flex', gap: '20px', alignItems: 'center' }}>
      {/* Brush Color Swatches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ marginRight: '8px' }}>Brush Color:</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          {colors.map((color) => (
            <div
              key={color}
              onClick={() => handleColorChange(color)}  // On click, set the selected color
              style={{
                width: '30px',
                height: '30px',
                backgroundColor: color,
                borderRadius: '50%',
                border: currentColor === color ? '3px solid #000' : '2px solid #fff',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* Brush Size Picker */}
      <label>
        <span style={{ marginRight: '8px' }}>Brush Size:</span>
        <input
          type="range"
          min="1"
          max="50"
          defaultValue="5"
          onChange={(e) => setSize(Number(e.target.value))}
        />
      </label>

      {/* Clear Canvas Button */}
      <Button className = {clsx({'bg-gray-100' : isEraser === false,
                                 'bg-white-100' : isEraser === true})} 
                                 onClick={() => setIsEraser(!isEraser)} >
      <EraserIcon className="mr-2 h-4 w-4" /> Eraser
      </Button>
      <Button onClick={clearCanvas}>Clear Canvas</Button>
      <Button onClick={sendCanvasData}>Calculate</Button>
    </div>
  );
}
