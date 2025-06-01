import React from 'react'

interface VirtualizedListProps {
  items: any[]
  renderItem: (item: any, index: number) => React.ReactNode
  itemHeight?: number
  className?: string
}

export function VirtualizedList({ 
  items, 
  renderItem, 
  itemHeight = 100,
  className 
}: VirtualizedListProps) {
  // Simple implementation - in a real app you'd use react-window or similar
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={item.id || index} style={{ height: itemHeight }}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}