import React from "react";

interface ToolbarProps{
    setColor : (color:string) => void;
    setSize : (size:number) => void;
    clearCanvas : () => void;
}

export default function Toolbar({setColor,setSize,clearCanvas}:ToolbarProps) {
    return (
        <div className="flex p-4">
            <label>
                BrushColor:
                
            </label>
        </div>
    );
}