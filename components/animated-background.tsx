"use client"

import { useEffect, useState } from "react"

interface AnimatedBackgroundProps {
  darkMode: boolean
}

export function AnimatedBackground({ darkMode }: AnimatedBackgroundProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([])

  useEffect(() => {
    // Generate random particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 6,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <div className={`animated-gradient absolute inset-0 ${darkMode ? "opacity-100" : "opacity-50"}`} />

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`floating-particle absolute h-2 w-2 rounded-full ${darkMode ? "bg-primary/20" : "bg-primary/30"}`}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      <div
        className={`absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl ${darkMode ? "bg-primary/10" : "bg-primary/20"}`}
      />
      <div
        className={`absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl ${darkMode ? "bg-accent/10" : "bg-accent/20"}`}
      />
    </div>
  )
}
