import { motion } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

export function CalendarView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calendar className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Calendar View</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.button
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.button>
          
          <div className="px-4 py-2 font-semibold">
            January 2024
          </div>
          
          <motion.button
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Coming soon placeholder */}
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold mb-2">Calendar View Coming Soon</h3>
          <p className="text-muted-foreground">
            View and manage your tasks in a beautiful calendar interface
          </p>
        </div>
      </div>
    </motion.div>
  )
}