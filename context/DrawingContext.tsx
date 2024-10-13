import React, { createContext,useContext,useState,ReactNode } from "react";

interface DrawingContextType {
    color : string;
    setColor : (color:string) => void;
    size : number;
    setSize : (size: number) => void;
    isEraser : boolean;
    setIsEraser : (eraser:boolean) => void;
}

const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

export const DrawingProvider : React.FC<{children : ReactNode}> = ({children}) => {
    const [color, setColor] = useState<string>("#ffffff");
    const [size, setSize] = useState<number>(5);
    const [isEraser, setIsEraser] = useState<boolean>(false);
    return(
        <DrawingContext.Provider value={{color, setColor, size, setSize, isEraser, setIsEraser }}>
            {children}
        </DrawingContext.Provider>
    )
}

export const useDrawingContext = () =>{
    const context = useContext(DrawingContext);
    if(!context){
        throw new Error("useDrawingContext must be used within a DrawingProvider");
    }
    return context;
}

