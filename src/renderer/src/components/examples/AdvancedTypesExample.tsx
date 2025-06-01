/**
 * Example component demonstrating advanced TypeScript 5.8 patterns
 * This showcases practical usage of const contexts for template literals
 * and other cutting-edge TypeScript features for 2025
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  API_ENDPOINTS,
  THEME_CONFIG,
  STATUS_CONFIG,
  APP_CONFIG,
  createTaskId,
  createProjectId,
  TypeSafeQueryBuilder,
  type TaskId,
  type ProjectId,
} from '@/lib/advanced-types';

// Type-safe API client using template literals and const contexts
class TypeSafeAPIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = APP_CONFIG.api.baseUrl;
  }

  // Template literal method for type-safe endpoint building
  private buildUrl<T extends string>(endpoint: T): `${string}/${T}` {
    return `${this.baseUrl}/${endpoint}` as const;
  }

  // Type-safe methods using const assertion patterns
  async getTasks() {
    const url = this.buildUrl(API_ENDPOINTS.tasks.list);
    // In real implementation, this would make an actual API call
    console.log('Fetching tasks from:', url);
    return [];
  }

  async getProjects() {
    const url = this.buildUrl(API_ENDPOINTS.projects.list);
    console.log('Fetching projects from:', url);
    return [];
  }

  async createTask(data: { title: string; description: string }) {
    const url = this.buildUrl(API_ENDPOINTS.tasks.create);
    console.log('Creating task at:', url, data);
    return { id: createTaskId('task-123'), ...data };
  }
}

// Remove unused form field configuration for now to focus on working examples

// Status badge component using const context patterns
const StatusBadge: React.FC<{
  status: string;
  type: 'task' | 'project';
}> = ({ status, type }) => {
  // Type-safe access to status configurations
  if (type === 'task') {
    const config = STATUS_CONFIG.task[status as keyof typeof STATUS_CONFIG.task];
    if (!config) return null;
    
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color} bg-current/10`}
      >
        <span>{config.icon}</span>
        {config.label}
      </motion.span>
    );
  } else {
    const config = STATUS_CONFIG.project[status as keyof typeof STATUS_CONFIG.project];
    if (!config) return null;
    
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color} bg-current/10`}
      >
        <span>{config.icon}</span>
        {config.label}
      </motion.span>
    );
  }
};

// Main example component
export const AdvancedTypesExample: React.FC = () => {
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(null);
  const [apiClient] = useState(() => new TypeSafeAPIClient());

  // Demonstrate type-safe query building
  const buildQuery = useCallback(() => {
    const query = new TypeSafeQueryBuilder()
      .select('id, title, status')
      .from('tasks')
      .where('priority = "high"')
      .build();
    
    console.log('Generated query:', query);
    return query;
  }, []);

  // Demonstrate branded type creation
  const handleCreateTask = useCallback(async () => {
    const taskId = createTaskId(`task-${Date.now()}`);
    const projectId = createProjectId(`project-${Date.now()}`);
    
    setSelectedTaskId(taskId);
    setSelectedProjectId(projectId);
    
    try {
      const result = await apiClient.createTask({
        title: 'New Advanced Task',
        description: 'This task demonstrates advanced TypeScript patterns'
      });
      console.log('Created task:', result);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  }, [apiClient]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6 space-y-6"
    >
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-2xl font-bold mb-4">Advanced TypeScript 5.8 Patterns Demo</h2>
        <p className="text-muted-foreground mb-6">
          This component demonstrates cutting-edge TypeScript patterns including const contexts 
          for template literals, branded types, and type-safe configurations.
        </p>

        {/* Status Examples */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Type-Safe Status System</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="pending" type="task" />
            <StatusBadge status="inProgress" type="task" />
            <StatusBadge status="completed" type="task" />
            <StatusBadge status="active" type="project" />
            <StatusBadge status="paused" type="project" />
            <StatusBadge status="archived" type="project" />
          </div>
        </div>

        {/* API Endpoints Demo */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Type-Safe API Endpoints</h3>
          <div className="bg-muted rounded p-4 font-mono text-sm">
            <div>Tasks List: {API_ENDPOINTS.tasks.list}</div>
            <div>Tasks Create: {API_ENDPOINTS.tasks.create}</div>
            <div>Projects List: {API_ENDPOINTS.projects.list}</div>
            <div>Projects Create: {API_ENDPOINTS.projects.create}</div>
          </div>
        </div>

        {/* Theme Configuration Demo */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Type-Safe Theme Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Primary Colors</div>
              <div className="flex gap-2">
                {Object.entries(THEME_CONFIG.colors.primary).map(([shade, color]) => (
                  <div
                    key={shade}
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: color }}
                    title={`primary-${shade}: ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Spacing Scale</div>
              <div className="space-y-1">
                {Object.entries(THEME_CONFIG.spacing).map(([size, value]) => (
                  <div key={size} className="text-xs font-mono">
                    {size}: {value}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Demo */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Interactive Demo</h3>
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCreateTask}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Task (Branded Types)
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={buildQuery}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
            >
              Build Type-Safe Query
            </motion.button>
          </div>

          {selectedTaskId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <div className="text-sm">
                <strong>Selected Task ID (Branded):</strong> <code>{selectedTaskId}</code>
              </div>
            </motion.div>
          )}

          {selectedProjectId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <div className="text-sm">
                <strong>Selected Project ID (Branded):</strong> <code>{selectedProjectId}</code>
              </div>
            </motion.div>
          )}
        </div>

        {/* Configuration Display */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">App Configuration (Const Context)</h3>
          <div className="bg-muted rounded p-4">
            <pre className="text-xs overflow-auto">
              {JSON.stringify(APP_CONFIG, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdvancedTypesExample;