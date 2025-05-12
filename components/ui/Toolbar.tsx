import React, { useState } from "react";
import { useDrawingContext } from "@/context/DrawingContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { EraserIcon, CircleIcon, TrashIcon } from "@radix-ui/react-icons";

interface ToolbarProps {
  clearCanvas: () => void;
  sendCanvasData: () => void;
}

const colors = [
  '#FF5733', // Vibrant Red
  '#33FF57', // Bright Green
  '#3357FF', // Deep Blue
  '#FFFF33', // Bright Yellow
  '#FF33FF', // Magenta
  '#333333', // Dark Gray
  '#FFFFFF'  // White
];

export default function Toolbar({
  clearCanvas,
  sendCanvasData
}: ToolbarProps) {
  const [currentColor, setCurrentColor] = useState(colors[0]);
  const { setColor, setSize, isEraser, setIsEraser } = useDrawingContext();

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    setColor(color);
    setIsEraser(false);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 p-2 bg-transparent opacity-1 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 transition-all duration-300 hover:opacity-100 hover:bg-white/30 hover:shadow-xl group">
        {/* Color Picker */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium opacity-1 group-hover:opacity-100 transition-opacity">Color:</span>
          <div className="flex gap-2">
            {colors.map((color) => (
              <Tooltip key={color}>
                <TooltipTrigger>
                  <div
                    onClick={() => handleColorChange(color)}
                    className={cn(
                      'w-6 h-6 rounded-full cursor-pointer transition-all',
                      currentColor === color 
                        ? 'ring-2 ring-primary ring-offset-2' 
                        : 'hover:ring-1 hover:ring-muted-foreground'
                    )}
                    style={{ backgroundColor: color }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select {color}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Brush Size Slider */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Size:</span>
          <Slider
            defaultValue={[5]}
            max={50}
            min={1}
            step={1}
            onValueChange={(value) => setSize(value[0])}
            className="w-32"
          />
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isEraser ? 'secondary' : 'outline'}
                size="icon"
                onClick={() => setIsEraser(!isEraser)}
              >
                <EraserIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isEraser ? 'Drawing Mode' : 'Eraser Mode'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={clearCanvas}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear Canvas</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                onClick={sendCanvasData}
              >
                <CircleIcon className="mr-2 h-4 w-4" />
                Calculate
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Process Canvas Data</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
