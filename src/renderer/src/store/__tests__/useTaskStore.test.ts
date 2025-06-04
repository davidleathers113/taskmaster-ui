/**
 * Core Task Store Tests (2025)
 * 
 * Comprehensive test suite for the main Zustand task store,
 * covering CRUD operations, state management, and store integrations.
 * 
 * Following 2025 patterns for state management testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Global type declarations for test environment
declare global {
  const vi: typeof import('vitest').vi
  interface GlobalThis {
    __mockElectron?: any
    __electron?: any
    electronAPI?: any
    taskmaster?: any
    __DEV__?: boolean
    __TEST__?: boolean
  }
}

import { act, renderHook } from '@testing-library/react';
import { useTaskStore } from '../useTaskStore';
import { testUtils } from '@tests/setup';
import type { Task, ViewMode, UserSettings } from '@/types';

// Mock analytics generation
vi.mock('@/lib/utils', () => ({
  generateAnalytics: vi.fn(() => ({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    completionRate: 0,
    averageCompletionTime: 0,
    tasksByPriority: { low: 0, medium: 0, high: 0 },
    tasksByStatus: { 
      pending: 0, 
      'in-progress': 0, 
      done: 0, 
      review: 0, 
      deferred: 0, 
      cancelled: 0 
    },
    velocityMetrics: { 
      tasksCompletedLastWeek: 0, 
      tasksCompletedThisWeek: 0, 
      trend: 'stable' 
    },
    burndownData: []
  })),
  generateId: vi.fn(() => Math.floor(Math.random() * 1000000))
}));

describe('useTaskStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useTaskStore.getState().resetStore();
    });
  });

  describe('Task CRUD Operations', () => {
    it('should add a task successfully', () => {
      const store = useTaskStore.getState();
      const mockTask = testUtils.createMockTask({
        title: 'New Task',
        description: 'Test task creation'
      });

      act(() => {
        store.addTask(mockTask);
      });

      const tasks = store.tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        title: 'New Task',
        description: 'Test task creation',
        status: 'pending',
        priority: 'medium'
      });
      expect(tasks[0].id).toBeDefined();
      expect(tasks[0].createdAt).toBeDefined();
      expect(tasks[0].updatedAt).toBeDefined();
    });

    it('should update a task successfully', () => {
      const store = useTaskStore.getState();
      const mockTask = testUtils.createMockTask();

      // Add task first
      act(() => {
        store.addTask(mockTask);
      });

      const taskId = store.tasks[0].id;

      // Update the task
      act(() => {
        store.updateTask(taskId, {
          title: 'Updated Title',
          status: 'in-progress',
          priority: 'high'
        });
      });

      const updatedTask = store.getTaskById(taskId);
      expect(updatedTask).toMatchObject({
        title: 'Updated Title',
        status: 'in-progress',
        priority: 'high'
      });
      expect(updatedTask?.updatedAt).not.toBe(mockTask.updatedAt);
    });

    it('should delete a task successfully', () => {
      const store = useTaskStore.getState();
      const mockTask = testUtils.createMockTask();

      // Add task first
      act(() => {
        store.addTask(mockTask);
      });

      expect(store.tasks).toHaveLength(1);
      const taskId = store.tasks[0].id;

      // Delete the task
      act(() => {
        store.deleteTask(taskId);
      });

      expect(store.tasks).toHaveLength(0);
      expect(store.getTaskById(taskId)).toBeUndefined();
    });

    it('should duplicate a task with new ID', () => {
      const store = useTaskStore.getState();
      const mockTask = testUtils.createMockTask({
        title: 'Original Task'
      });

      // Add task first
      act(() => {
        store.addTask(mockTask);
      });

      const originalId = store.tasks[0].id;

      // Duplicate the task
      act(() => {
        store.duplicateTask(originalId);
      });

      expect(store.tasks).toHaveLength(2);
      const duplicatedTask = store.tasks.find(t => t.id !== originalId);
      
      expect(duplicatedTask).toBeDefined();
      expect(duplicatedTask?.title).toBe('Original Task (Copy)');
      expect(duplicatedTask?.id).not.toBe(originalId);
      expect(duplicatedTask?.createdAt).not.toBe(store.tasks[0].createdAt);
    });
  });

  describe('Subtask Operations', () => {
    let parentTaskId: number;

    beforeEach(() => {
      const store = useTaskStore.getState();
      const parentTask = testUtils.createMockTask({
        title: 'Parent Task'
      });

      act(() => {
        store.addTask(parentTask);
      });

      parentTaskId = store.tasks[0].id;
    });

    it('should add a subtask to a parent task', () => {
      const store = useTaskStore.getState();
      const subtask = {
        title: 'Subtask 1',
        description: 'First subtask',
        status: 'pending' as const,
        priority: 'low' as const
      };

      act(() => {
        store.addSubtask(parentTaskId, subtask);
      });

      const parentTask = store.getTaskById(parentTaskId);
      expect(parentTask?.subtasks).toHaveLength(1);
      expect(parentTask?.subtasks[0]).toMatchObject(subtask);
      expect(parentTask?.subtasks[0].id).toBeDefined();
    });

    it('should update a subtask', () => {
      const store = useTaskStore.getState();

      // Add subtask first
      act(() => {
        store.addSubtask(parentTaskId, {
          title: 'Original Subtask',
          description: 'Original description',
          status: 'pending',
          priority: 'low'
        });
      });

      const parentTask = store.getTaskById(parentTaskId);
      const subtaskId = parentTask?.subtasks[0].id!;

      // Update subtask
      act(() => {
        store.updateSubtask(parentTaskId, subtaskId, {
          title: 'Updated Subtask',
          status: 'done'
        });
      });

      const updatedParent = store.getTaskById(parentTaskId);
      const updatedSubtask = updatedParent?.subtasks.find(s => s.id === subtaskId);
      
      expect(updatedSubtask).toMatchObject({
        title: 'Updated Subtask',
        status: 'done'
      });
    });

    it('should delete a subtask', () => {
      const store = useTaskStore.getState();

      // Add subtask first
      act(() => {
        store.addSubtask(parentTaskId, {
          title: 'Subtask to Delete',
          description: 'Will be deleted',
          status: 'pending',
          priority: 'medium'
        });
      });

      const parentTask = store.getTaskById(parentTaskId);
      const subtaskId = parentTask?.subtasks[0].id!;

      expect(parentTask?.subtasks).toHaveLength(1);

      // Delete subtask
      act(() => {
        store.deleteSubtask(parentTaskId, subtaskId);
      });

      const updatedParent = store.getTaskById(parentTaskId);
      expect(updatedParent?.subtasks).toHaveLength(0);
    });
  });

  describe('Filtering and Querying', () => {
    beforeEach(() => {
      const store = useTaskStore.getState();
      
      // Add sample tasks with different properties
      const tasks = [
        testUtils.createMockTask({ 
          title: 'High Priority Task', 
          priority: 'high', 
          status: 'pending' 
        }),
        testUtils.createMockTask({ 
          title: 'Completed Task', 
          priority: 'medium', 
          status: 'done' 
        }),
        testUtils.createMockTask({ 
          title: 'In Progress Task', 
          priority: 'low', 
          status: 'in-progress' 
        })
      ];

      act(() => {
        tasks.forEach(task => store.addTask(task));
      });
    });

    it('should filter tasks by status', () => {
      const store = useTaskStore.getState();
      
      const pendingTasks = store.getTasksByStatus('pending');
      const completedTasks = store.getTasksByStatus('done');
      const inProgressTasks = store.getTasksByStatus('in-progress');

      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].title).toBe('High Priority Task');
      
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].title).toBe('Completed Task');
      
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].title).toBe('In Progress Task');
    });

    it('should filter tasks by priority', () => {
      const store = useTaskStore.getState();
      
      const highPriorityTasks = store.getTasksByPriority('high');
      const mediumPriorityTasks = store.getTasksByPriority('medium');
      const lowPriorityTasks = store.getTasksByPriority('low');

      expect(highPriorityTasks).toHaveLength(1);
      expect(mediumPriorityTasks).toHaveLength(1);
      expect(lowPriorityTasks).toHaveLength(1);
    });

    it('should apply search query filter', () => {
      const store = useTaskStore.getState();

      act(() => {
        store.setSearchQuery('High Priority');
      });

      const filteredTasks = store.getFilteredTasks();
      expect(filteredTasks).toHaveLength(1);
      expect(filteredTasks[0].title).toBe('High Priority Task');
    });

    it('should combine multiple filters', () => {
      const store = useTaskStore.getState();

      act(() => {
        store.setFilters({
          status: ['pending'],
          priority: ['high']
        });
      });

      const filteredTasks = store.getFilteredTasks();
      expect(filteredTasks).toHaveLength(1);
      expect(filteredTasks[0].title).toBe('High Priority Task');
    });
  });

  describe('View Mode Management', () => {
    it('should set view mode correctly', () => {
      const store = useTaskStore.getState();
      
      const newViewMode: ViewMode = {
        type: 'kanban',
        density: 'compact',
        groupBy: 'priority',
        sortBy: 'title',
        sortOrder: 'desc'
      };

      act(() => {
        store.setViewMode(newViewMode);
      });

      expect(store.viewMode).toEqual(newViewMode);
    });

    it('should toggle sidebar collapsed state', () => {
      const store = useTaskStore.getState();
      
      expect(store.sidebarCollapsed).toBe(false);

      act(() => {
        store.setSidebarCollapsed(true);
      });

      expect(store.sidebarCollapsed).toBe(true);
    });
  });

  describe('User Settings Management', () => {
    it('should update user settings', () => {
      const store = useTaskStore.getState();
      
      const newSettings = testUtils.createMockUserSettings({
        ui: { theme: 'dark', density: 'compact' },
        notifications: { enabled: false }
      });

      act(() => {
        store.setUserSettings(newSettings);
      });

      expect(store.userSettings).toEqual(newSettings);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      const store = useTaskStore.getState();
      
      // Add multiple tasks
      const tasks = Array.from({ length: 5 }, (_, i) => 
        testUtils.createMockTask({ 
          title: `Task ${i + 1}`,
          status: i % 2 === 0 ? 'pending' : 'done'
        })
      );

      act(() => {
        tasks.forEach(task => store.addTask(task));
      });
    });

    it('should update multiple tasks at once', () => {
      const store = useTaskStore.getState();
      const taskIds = store.tasks.slice(0, 3).map(t => t.id);

      act(() => {
        store.updateMultipleTasks(taskIds, { priority: 'high' });
      });

      const updatedTasks = taskIds.map(id => store.getTaskById(id));
      updatedTasks.forEach(task => {
        expect(task?.priority).toBe('high');
      });
    });

    it('should delete multiple tasks at once', () => {
      const store = useTaskStore.getState();
      const initialCount = store.tasks.length;
      const taskIds = store.tasks.slice(0, 2).map(t => t.id);

      act(() => {
        store.deleteMultipleTasks(taskIds);
      });

      expect(store.tasks).toHaveLength(initialCount - 2);
      taskIds.forEach(id => {
        expect(store.getTaskById(id)).toBeUndefined();
      });
    });
  });

  describe('Data Import/Export', () => {
    it('should export tasks to JSON format', () => {
      const store = useTaskStore.getState();
      
      // Add sample tasks
      act(() => {
        store.addTask(testUtils.createMockTask({ title: 'Export Test 1' }));
        store.addTask(testUtils.createMockTask({ title: 'Export Test 2' }));
      });

      const exportData = store.exportToJSON();
      
      expect(exportData).toHaveProperty('tasks');
      expect(exportData.tasks).toHaveLength(2);
      expect(exportData.tasks[0].title).toBe('Export Test 1');
      expect(exportData.tasks[1].title).toBe('Export Test 2');
    });

    it('should import tasks from JSON format', () => {
      const store = useTaskStore.getState();
      
      const importData = {
        tasks: [
          testUtils.createMockTask({ title: 'Imported Task 1' }),
          testUtils.createMockTask({ title: 'Imported Task 2' })
        ]
      };

      act(() => {
        store.loadFromJSON(importData);
      });

      expect(store.tasks).toHaveLength(2);
      expect(store.tasks[0].title).toBe('Imported Task 1');
      expect(store.tasks[1].title).toBe('Imported Task 2');
    });

    it('should reset store to initial state', () => {
      const store = useTaskStore.getState();
      
      // Add some data
      act(() => {
        store.addTask(testUtils.createMockTask());
        store.setSearchQuery('test');
        store.setSelectedTask(1);
      });

      expect(store.tasks).toHaveLength(1);
      expect(store.searchQuery).toBe('test');
      expect(store.selectedTask).toBe(1);

      // Reset store
      act(() => {
        store.resetStore();
      });

      expect(store.tasks).toHaveLength(0);
      expect(store.searchQuery).toBe('');
      expect(store.selectedTask).toBeNull();
    });
  });

  describe('Dependencies and Relationships', () => {
    let taskIds: number[];

    beforeEach(() => {
      const store = useTaskStore.getState();
      
      // Create tasks with dependencies
      const tasks = [
        testUtils.createMockTask({ title: 'Task A', dependencies: [] }),
        testUtils.createMockTask({ title: 'Task B', dependencies: [] }),
        testUtils.createMockTask({ title: 'Task C', dependencies: [] })
      ];

      act(() => {
        tasks.forEach(task => store.addTask(task));
      });

      taskIds = store.tasks.map(t => t.id);
    });

    it('should find dependent tasks', () => {
      const store = useTaskStore.getState();
      
      // Make Task B depend on Task A
      act(() => {
        store.updateTask(taskIds[1], { dependencies: [taskIds[0]] });
      });

      const dependentTasks = store.getDependentTasks(taskIds[0]);
      expect(dependentTasks).toHaveLength(1);
      expect(dependentTasks[0].title).toBe('Task B');
    });

    it('should find blocking tasks', () => {
      const store = useTaskStore.getState();
      
      // Make Task B depend on Task A
      act(() => {
        store.updateTask(taskIds[1], { dependencies: [taskIds[0]] });
      });

      const blockingTasks = store.getBlockingTasks(taskIds[1]);
      expect(blockingTasks).toHaveLength(1);
      expect(blockingTasks[0].title).toBe('Task A');
    });
  });

  describe('Performance and Reactivity', () => {
    it('should handle large numbers of tasks efficiently', () => {
      const store = useTaskStore.getState();
      const startTime = performance.now();
      
      // Add many tasks
      act(() => {
        for (let i = 0; i < 1000; i++) {
          store.addTask(testUtils.createMockTask({ 
            title: `Performance Test Task ${i}`
          }));
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(store.tasks).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should update analytics when tasks change', () => {
      const store = useTaskStore.getState();
      
      // Add tasks with different statuses
      act(() => {
        store.addTask(testUtils.createMockTask({ status: 'pending' }));
        store.addTask(testUtils.createMockTask({ status: 'done' }));
        store.addTask(testUtils.createMockTask({ status: 'in-progress' }));
      });

      const analytics = store.analytics;
      expect(analytics.totalTasks).toBe(3);
      expect(analytics.tasksByStatus.pending).toBe(1);
      expect(analytics.tasksByStatus.done).toBe(1);
      expect(analytics.tasksByStatus['in-progress']).toBe(1);
    });
  });

  describe('Hook Integration', () => {
    it('should work correctly with renderHook', () => {
      const { result } = renderHook(() => useTaskStore());
      
      expect(result.current.tasks).toEqual([]);
      expect(typeof result.current.addTask).toBe('function');
      
      const mockTask = testUtils.createMockTask();
      
      act(() => {
        result.current.addTask(mockTask);
      });
      
      expect(result.current.tasks).toHaveLength(1);
    });

    it('should trigger re-renders when state changes', () => {
      let renderCount = 0;
      
      const { result } = renderHook(() => {
        renderCount++;
        return useTaskStore(state => state.tasks.length);
      });
      
      expect(renderCount).toBe(1);
      expect(result.current).toBe(0);
      
      act(() => {
        useTaskStore.getState().addTask(testUtils.createMockTask());
      });
      
      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);
    });
  });
});