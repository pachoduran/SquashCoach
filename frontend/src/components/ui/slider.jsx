import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}>
    <SliderPrimitive.Track
      className="relative h-2 w-full grow overflow-hidden rounded-full bg-brand-black border border-white/20">
      <SliderPrimitive.Range className="absolute h-full bg-brand-yellow" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-5 w-5 rounded-full border-2 border-brand-yellow bg-brand-dark-gray shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow disabled:pointer-events-none disabled:opacity-50 hover:bg-brand-yellow hover:scale-110 cursor-pointer" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
