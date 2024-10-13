"use client";
import React, { useEffect } from "react";
import Canvas, { CanvasHandle } from "@/components/ui/Canvas";
import { DrawingProvider } from "@/context/DrawingContext";
// import { useDrawingContext } from "@/context/DrawingContext";
import Toolbar from "@/components/ui/Toolbar";
import { useRef, useState } from "react";
// import { Button } from "@/components/ui/button";

interface dataType {
  expr: string;
  result: string;
}

export default function Page() {
  const canvasRef = useRef<CanvasHandle | null>(null);
  const [message, setMessage] = useState<string>("");
  const [dictOfVars, setDictOfVars] = useState<dataType[] | null>(null);

  const clearCanvas = () => {
    const context = canvasRef.current?.getContext();
    if (context) {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
  };
  const PrintCanvas = (dictOfVars: dataType[] | null) => {
    const context = canvasRef.current?.getContext();
    if (context) {
      // Clear the canvas before printing new content
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    if (dictOfVars) {
      dictOfVars.forEach((data: dataType, idx) => {
        const context = canvasRef.current?.getContext();
        console.log(idx);
        if (context) {
          context.font = "50px Arial";
          context.fillStyle = "white";
          context.fillText(
            `${data.expr} = ${data.result}`,
            50 * (idx + 1),
            80 * (idx + 1)
          );
        }
        console.log(`${data.expr} = ${data.result}`);
      });
    } else {
      console.log("No data to print.");
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

        const resp = await response.json();
        console.log(resp);
        const { message, result } = resp;
        if (response.ok) {
          setMessage(message); // Success message from the server
          console.log(result);
          const res = await JSON.parse(result);
          console.log(res);
          setDictOfVars(res); // Update the dictionary of variables with the server's result
          // console.log(dictOfVars); //
          // console.log(typeof result);
          // await PrintCanvas(dictOfVars);
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
  useEffect(() => {
    if (dictOfVars) {
      PrintCanvas(dictOfVars);
      // clearCanvas();
    }
  }, [dictOfVars]);

  return (
    <DrawingProvider>
      <div>
        <Toolbar clearCanvas={clearCanvas} sendCanvasData={sendCanvasData} />
        <Canvas ref={canvasRef} />
      </div>
    </DrawingProvider>
  );
}
