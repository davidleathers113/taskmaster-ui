import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactApexChart from 'react-apexcharts'
import { 
  Cpu, 
  MemoryStick, 
  Activity, 
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Monitor,
  Gauge,
  BarChart3,
  RefreshCw,
  Settings,
  Download,
  Play,
  Pause
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { defaultPerformanceDashboardConfig, getAlertThresholdByMetricId } from '@/lib/config/performance-dashboard'
import type { PerformanceMetric } from '@/lib/performance-database'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  status?: 'good' | 'warning' | 'critical'
  icon: React.ComponentType<{ className?: string }>
  color?: string
  index: number
}

function MetricCard({ title, value, unit, change, trend, status, icon: Icon, color = 'blue', index }: MetricCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-yellow-500 to-yellow-600'
  }

  const statusColors = {
    good: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    warning: 'text-yellow-600 border-yellow-200 bg-yellow-50',
    critical: 'text-red-600 border-red-200 bg-red-50'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ 
        scale: 1.02,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
      }}
      className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-6 glass-morphism"
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute top-0 right-0 w-20 h-20 opacity-10 rounded-bl-3xl",
        `bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]}`
      )} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-3 rounded-lg bg-gradient-to-br",
            colorClasses[color as keyof typeof colorClasses]
          )}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            {status && (
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium border",
                statusColors[status]
              )}>
                {status.toUpperCase()}
              </div>
            )}
            
            {change && (
              <div className={cn(
                "flex items-center space-x-1 text-sm",
                trend === 'up' && "text-emerald-600",
                trend === 'down' && "text-red-600",
                trend === 'neutral' && "text-muted-foreground"
              )}>
                {trend === 'up' && <TrendingUp className="w-4 h-4" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4" />}
                <span>{change}</span>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-2xl font-bold mb-1">
            {value}
            {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
          </h3>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
    </motion.div>
  )
}

interface ChartWidgetProps {
  title: string
  metricId: string
  data: PerformanceMetric[]
  chartType: 'line' | 'area' | 'bar' | 'gauge'
  height?: number
  showControls?: boolean
  index: number
}

function ChartWidget({ title, metricId, data, chartType, height = 300, showControls = true, index }: ChartWidgetProps) {
  const [isRealTime, setIsRealTime] = useState(true)
  
  // Extract data for the chart based on metric type
  const getChartData = () => {
    if (!data || data.length === 0) return []
    
    return data.map(metric => {
      let value = 0
      switch (metricId) {
        case 'cpu_usage':
          value = metric.system?.cpu?.usage || 0
          break
        case 'memory_usage':
          value = metric.system?.memory?.usagePercent || 0
          break
        case 'fps':
          value = metric.application?.rendering?.fps || 0
          break
        case 'memory_heap_used':
          value = (metric.system?.memory?.process?.heapUsed || 0) / (1024 * 1024) // Convert to MB
          break
        case 'jank_count':
          value = metric.application?.rendering?.jank || 0
          break
        default:
          value = 0
      }
      
      return {
        x: metric.timestamp,
        y: value
      }
    }).slice(-50) // Last 50 data points for performance
  }

  const chartData = getChartData()
  
  const getChartOptions = () => {
    const baseOptions = {
      chart: {
        id: metricId,
        type: chartType as any,
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        },
        toolbar: {
          show: showControls,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        background: 'transparent'
      },
      theme: {
        mode: 'light' as const
      },
      colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
      stroke: {
        width: 2,
        curve: 'smooth' as const
      },
      fill: {
        type: chartType === 'area' ? 'gradient' : 'solid',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3,
          stops: [0, 100]
        }
      },
      grid: {
        show: true,
        borderColor: '#e5e7eb',
        strokeDashArray: 3,
        position: 'back' as const
      },
      xaxis: {
        type: 'datetime' as const,
        labels: {
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          },
          formatter: (value: any) => {
            return new Date(value).toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          }
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          },
          formatter: (value: number) => {
            if (metricId === 'memory_heap_used') {
              return `${value.toFixed(1)} MB`
            } else if (metricId === 'fps') {
              return `${value.toFixed(0)} FPS`
            } else if (metricId.includes('usage')) {
              return `${value.toFixed(1)}%`
            }
            return value.toFixed(1)
          }
        }
      },
      tooltip: {
        enabled: true,
        theme: 'light',
        x: {
          formatter: (value: any) => {
            return new Date(value).toLocaleString()
          }
        },
        y: {
          formatter: (value: number) => {
            if (metricId === 'memory_heap_used') {
              return `${value.toFixed(2)} MB`
            } else if (metricId === 'fps') {
              return `${value.toFixed(1)} FPS`
            } else if (metricId.includes('usage')) {
              return `${value.toFixed(1)}%`
            }
            return value.toFixed(2)
          }
        }
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: height * 0.8
            }
          }
        }
      ]
    }

    if (chartType === 'gauge') {
      const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].y : 0
      return {
        ...baseOptions,
        chart: {
          ...baseOptions.chart,
          type: 'radialBar'
        },
        plotOptions: {
          radialBar: {
            startAngle: -135,
            endAngle: 225,
            hollow: {
              margin: 0,
              size: '70%',
              background: 'transparent'
            },
            track: {
              background: '#e5e7eb',
              strokeWidth: '67%',
              margin: 0
            },
            dataLabels: {
              name: {
                show: false
              },
              value: {
                show: true,
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#374151',
                formatter: (val: number) => {
                  if (metricId === 'fps') return `${val.toFixed(0)}`
                  return `${val.toFixed(1)}%`
                }
              }
            }
          }
        },
        series: [latestValue]
      }
    }

    return baseOptions
  }

  const series = chartType === 'gauge' 
    ? [chartData.length > 0 ? chartData[chartData.length - 1].y : 0]
    : [{
        name: title,
        data: chartData
      }]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.2 }}
      className="bg-card border border-border/50 rounded-xl p-6 glass-morphism"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center space-x-2">
          {showControls && (
            <button
              onClick={() => setIsRealTime(!isRealTime)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isRealTime 
                  ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" 
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              title={isRealTime ? "Pause real-time updates" : "Resume real-time updates"}
            >
              {isRealTime ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
      
      <div className="w-full">
        <ReactApexChart
          options={getChartOptions()}
          series={series}
          type={chartType === 'gauge' ? 'radialBar' : chartType}
          height={height}
        />
      </div>
    </motion.div>
  )
}

export function PerformanceDashboard() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetric | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<PerformanceMetric[]>([])
  const [alerts, setAlerts] = useState<Array<{ type: string; message: string; severity: 'warning' | 'critical' }>>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Simulate real-time data collection
  useEffect(() => {
    if (isMonitoring) {
      intervalRef.current = setInterval(() => {
        // Simulate metric data - in real implementation, this would come from the performance-monitor.js
        const mockMetric: PerformanceMetric = {
          timestamp: Date.now(),
          system: {
            cpu: {
              usage: Math.random() * 100,
              loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
              cores: 8
            },
            memory: {
              total: 16 * 1024 * 1024 * 1024, // 16GB
              free: Math.random() * 8 * 1024 * 1024 * 1024,
              used: Math.random() * 8 * 1024 * 1024 * 1024,
              usagePercent: Math.random() * 100,
              process: {
                heapUsed: Math.random() * 200 * 1024 * 1024, // 0-200MB
                heapTotal: 300 * 1024 * 1024, // 300MB
                external: Math.random() * 50 * 1024 * 1024,
                rss: Math.random() * 400 * 1024 * 1024
              }
            },
            uptime: Date.now() - (Math.random() * 86400000) // Random uptime up to 24h
          },
          application: {
            rendering: {
              fps: 30 + Math.random() * 30, // 30-60 FPS
              jank: Math.floor(Math.random() * 5), // 0-5 jank events
              paintTime: Math.random() * 20 + 5 // 5-25ms
            },
            network: {
              requestCount: Math.floor(Math.random() * 100),
              avgLatency: Math.random() * 500 + 50,
              errorRate: Math.random() * 0.05
            },
            errors: {
              count: Math.floor(Math.random() * 3),
              types: ['javascript', 'network']
            }
          },
          metadata: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            monitorVersion: '1.0.0'
          }
        }

        setCurrentMetrics(mockMetric)
        setMetricsHistory(prev => [...prev.slice(-100), mockMetric]) // Keep last 100 metrics
      }, 5000) // Update every 5 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isMonitoring])

  const getMetricValue = (metricId: string): { value: number; unit: string; status: 'good' | 'warning' | 'critical' } => {
    if (!currentMetrics) return { value: 0, unit: '', status: 'good' }
    
    const alertConfig = getAlertThresholdByMetricId(defaultPerformanceDashboardConfig, metricId)
    
    let value = 0
    let unit = ''
    
    switch (metricId) {
      case 'cpu_usage':
        value = currentMetrics.system?.cpu?.usage || 0
        unit = '%'
        break
      case 'memory_usage':
        value = currentMetrics.system?.memory?.usagePercent || 0
        unit = '%'
        break
      case 'fps':
        value = currentMetrics.application?.rendering?.fps || 0
        unit = 'FPS'
        break
      case 'memory_heap_used':
        value = (currentMetrics.system?.memory?.process?.heapUsed || 0) / (1024 * 1024)
        unit = 'MB'
        break
      case 'jank_count':
        value = currentMetrics.application?.rendering?.jank || 0
        unit = 'events'
        break
    }
    
    let status: 'good' | 'warning' | 'critical' = 'good'
    if (alertConfig) {
      if (metricId === 'fps') {
        // For FPS, lower is worse
        if (value < alertConfig.criticalThreshold) status = 'critical'
        else if (value < alertConfig.warningThreshold) status = 'warning'
      } else {
        // For other metrics, higher is worse
        if (value > alertConfig.criticalThreshold) status = 'critical'
        else if (value > alertConfig.warningThreshold) status = 'warning'
      }
    }
    
    return { value, unit, status }
  }

  const metrics = [
    {
      id: 'cpu_usage',
      title: 'CPU Usage',
      icon: Cpu,
      color: 'blue'
    },
    {
      id: 'memory_usage',
      title: 'Memory Usage',
      icon: MemoryStick,
      color: 'purple'
    },
    {
      id: 'fps',
      title: 'Frame Rate',
      icon: Activity,
      color: 'emerald'
    },
    {
      id: 'memory_heap_used',
      title: 'Heap Memory',
      icon: Monitor,
      color: 'orange'
    }
  ]

  return (
    <motion.div 
      className="h-full overflow-auto p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold gradient-text mb-2">Performance Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time monitoring of system and application performance metrics
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors",
                isMonitoring 
                  ? "bg-red-100 text-red-700 hover:bg-red-200" 
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              )}
            >
              {isMonitoring ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}</span>
            </button>
            
            <button className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            
            <button className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center mt-4 space-x-4">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isMonitoring ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
            )} />
            <span className="text-sm text-muted-foreground">
              {isMonitoring ? 'Monitoring Active' : 'Monitoring Stopped'}
            </span>
          </div>
          
          {currentMetrics && (
            <div className="text-sm text-muted-foreground">
              Last Update: {new Date(currentMetrics.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, index) => {
          const { value, unit, status } = getMetricValue(metric.id)
          return (
            <MetricCard 
              key={metric.id}
              title={metric.title}
              value={value.toFixed(1)}
              unit={unit}
              status={status}
              icon={metric.icon}
              color={metric.color}
              index={index}
            />
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartWidget
          title="CPU Usage"
          metricId="cpu_usage"
          data={metricsHistory}
          chartType="area"
          index={0}
        />
        
        <ChartWidget
          title="Memory Usage"
          metricId="memory_usage"
          data={metricsHistory}
          chartType="line"
          index={1}
        />
        
        <ChartWidget
          title="Frame Rate"
          metricId="fps"
          data={metricsHistory}
          chartType="gauge"
          height={250}
          index={2}
        />
        
        <ChartWidget
          title="Heap Memory"
          metricId="memory_heap_used"
          data={metricsHistory}
          chartType="bar"
          index={3}
        />
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-xl p-6 glass-morphism"
        >
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold">Active Alerts</h3>
          </div>
          
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div 
                key={index}
                className={cn(
                  "p-3 rounded-lg border",
                  alert.severity === 'critical' ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.type}</span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    alert.severity === 'critical' ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  )}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}