import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

export function TimelineView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full p-6"
    >
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Clock className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Timeline View</h2>
      </div>

      {/* Coming soon placeholder */}
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏱️</div>
          <h3 className="text-xl font-semibold mb-2">Timeline View Coming Soon</h3>
          <p className="text-muted-foreground">
            Track task progress and dependencies in a Gantt-style timeline
          </p>
        </div>
      </div>
    </motion.div>
  )
}