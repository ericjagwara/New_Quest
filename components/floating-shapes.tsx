"use client"

import { useEffect, useState } from "react"

interface FloatingShape {
  id: number
  x: number
  y: number
  size: number
  color: string
  type: "circle" | "square" | "heart" | "star"
  speed: number
  direction: number
}

export function FloatingShapes() {
  const [shapes, setShapes] = useState<FloatingShape[]>([])

  useEffect(() => {
    const initialShapes: FloatingShape[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 40 + 20,
      color: [
        "from-pink-300/40 to-rose-400/40",
        "from-blue-300/40 to-indigo-400/40",
        "from-emerald-300/40 to-teal-400/40",
        "from-purple-300/40 to-violet-400/40",
        "from-yellow-300/40 to-orange-400/40",
        "from-cyan-300/40 to-sky-400/40",
        "from-lime-300/40 to-green-400/40",
        "from-fuchsia-300/40 to-pink-400/40",
      ][Math.floor(Math.random() * 8)],
      type: ["circle", "square", "heart", "star"][Math.floor(Math.random() * 4)] as any,
      speed: Math.random() * 2 + 0.5,
      direction: Math.random() * Math.PI * 2,
    }))
    setShapes(initialShapes)
  }, [])

  useEffect(() => {
    const animateShapes = () => {
      setShapes((prevShapes) =>
        prevShapes.map((shape) => {
          let newX = shape.x + Math.cos(shape.direction) * shape.speed
          let newY = shape.y + Math.sin(shape.direction) * shape.speed

          // Bounce off edges
          if (newX < 0 || newX > window.innerWidth) {
            shape.direction = Math.PI - shape.direction
            newX = Math.max(0, Math.min(window.innerWidth, newX))
          }
          if (newY < 0 || newY > window.innerHeight) {
            shape.direction = -shape.direction
            newY = Math.max(0, Math.min(window.innerHeight, newY))
          }

          return { ...shape, x: newX, y: newY }
        }),
      )
    }

    const interval = setInterval(animateShapes, 50)
    return () => clearInterval(interval)
  }, [])

  const renderShape = (shape: FloatingShape) => {
    const baseClasses = `absolute transition-all duration-100 bg-gradient-to-br ${shape.color}`
    const style = {
      left: `${shape.x}px`,
      top: `${shape.y}px`,
      width: `${shape.size}px`,
      height: `${shape.size}px`,
    }

    switch (shape.type) {
      case "circle":
        return <div key={shape.id} className={`${baseClasses} rounded-full animate-pulse`} style={style} />
      case "square":
        return (
          <div
            key={shape.id}
            className={`${baseClasses} transform rotate-45 animate-spin`}
            style={{ ...style, animationDuration: "8s" }}
          />
        )
      case "heart":
        return (
          <div key={shape.id} className="absolute animate-pulse" style={{ left: `${shape.x}px`, top: `${shape.y}px` }}>
            <div className="relative" style={{ width: `${shape.size}px`, height: `${shape.size}px` }}>
              <div
                className={`w-1/2 h-1/2 bg-gradient-to-br from-red-400/60 to-pink-500/60 rounded-full absolute top-0 left-0`}
              ></div>
              <div
                className={`w-1/2 h-1/2 bg-gradient-to-br from-red-400/60 to-pink-500/60 rounded-full absolute top-0 right-0`}
              ></div>
              <div
                className={`w-1/2 h-1/2 bg-gradient-to-br from-red-400/60 to-pink-500/60 transform rotate-45 absolute top-1/4 left-1/4`}
              ></div>
            </div>
          </div>
        )
      case "star":
        return (
          <div
            key={shape.id}
            className={`${baseClasses} animate-spin`}
            style={{
              ...style,
              clipPath:
                "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
              animationDuration: "6s",
            }}
          />
        )
      default:
        return null
    }
  }

  return <div className="absolute inset-0 overflow-hidden pointer-events-none">{shapes.map(renderShape)}</div>
}
