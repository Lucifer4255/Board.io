import React, { useState } from "react";
import { Button } from "./button";
interface ToolbarProps {
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  clearCanvas: () => void;
  sendCanvasData: () => void; // Function to send canvas data to server for processing.
}
const colors = ['#FF5733', '#33FF57', '#3357FF', '#FFFF33', '#FF33FF', '#333333', '#FFFFFF'];

export default function Toolbar({
  setColor,
  setSize,
  clearCanvas,
  sendCanvasData // Function to send canvas data to server for processing.
}: ToolbarProps) {
  const [currentColor, setCurrentColor] = useState(colors[0]);

  const handleColorChange = (color :string) => {
    setCurrentColor(color);
    setColor(color);
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
      <Button onClick={clearCanvas}>Clear Canvas</Button>
      <Button onClick={sendCanvasData}>Calculate</Button>
    </div>
  );
}
