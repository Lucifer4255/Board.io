"use client";
import React from "react";
import Canvas, { CanvasHandle } from "@/components/ui/Canvas";
import Toolbar from "@/components/ui/Toolbar";
import { useRef, useState } from "react";
// import { Button } from "@/components/ui/button";
export default function Page() {
  const [color, setColor] = useState<string>("#ffffff");
  const [size, setSize] = useState<number>(5);
  const canvasRef = useRef<CanvasHandle | null>(null);
  const [message, setMessage] = useState<string>("");

  const clearCanvas = () => {
    const context = canvasRef.current?.getContext();
    if (context) {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
  };
  const sendCanvasData = async () => {
    const context = canvasRef.current?.getContext();
    if (context) {
      const canvas = context.canvas;
      const imageData = canvas.toDataURL("image/png"); // Get the canvas as a base64 image

      try {
        const response = await fetch("/api/save-canvas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: imageData }), // Send the image data as JSON
        });

        const result = await response.json();

        if (response.ok) {
          setMessage(result.message); // Success message from the server
          console.log(message); //
        } else {
          setMessage("Failed to save canvas data.");
          console.log(message); //
        }
      } catch (error) {
        console.error("Error sending canvas data:", error);
        setMessage("Error occurred while saving canvas data.");
        console.log(message); //
      }
    }
  };
  return (
    <>
      <Toolbar
        setColor={setColor}
        setSize={setSize}
        clearCanvas={clearCanvas}
        sendCanvasData={sendCanvasData}
      />
      <Canvas ref={canvasRef} color={color} size={size} />
    </>
  );
}
