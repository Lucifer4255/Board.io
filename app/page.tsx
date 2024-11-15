// import Image from "next/image";
import { buttonVariants } from "@/components/ui/button"
import { Pencil1Icon } from "@radix-ui/react-icons";
import Link from "next/link";
export default function Home() {
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl p-6">
        Welcome to Board.io
      </h1>
      <p className="basis-1/6 text-xl text-muted-foreground">
        A digital whiteboard for your math help
      </p>
      <Link className={buttonVariants({ variant: "default" })} href='/Board'>
      <Pencil1Icon className="mr-2 h-4 w-4" /><span className="font-bold font-mono">Get Started</span>
      </Link>
    </div>
  );
}
