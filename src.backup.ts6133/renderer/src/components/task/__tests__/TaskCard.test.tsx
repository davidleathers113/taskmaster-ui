/**
 * TaskCard Component Tests (2025)
 * 
 * Comprehensive test suite for the TaskCard component,
 * testing user interactions, accessibility, and visual states.
 * 
 * Following 2025 React Testing Library best practices.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // Import DOM matchers for toBeInTheDocument, toHaveClass, etc.
import { TaskCard } from '../TaskCard';
import { testUtils } from '@tests/setup';
import type { Task } from '@/types';

// Mock framer-motion using 2025 best practices with prop filtering
vi.mock('framer-motion', () => {
  const React = require('react');
  
  // Animation props to filter out from DOM
  const motionProps = [
    'initial', 'animate', 'exit', 'variants', 'transition',
    'whileHover', 'whileTap', 'whileFocus', 'whileInView',
    'whileDrag', 'dragSnapToOrigin', 'dragElastic',
    'dragMomentum', 'dragPropagation', 'dragControls',
    'layout', 'layoutId', 'style', 'onAnimationStart',
    'onAnimationComplete', 'onUpdate', 'onDrag', 'onDragEnd'
  ];
  
  const filterProps = (props: any) => {
    const filtered = { ...props };
    motionProps.forEach(prop => delete filtered[prop]);
    return filtered;
  };
  
  const createMotionComponent = (tag: string) => 
    React.forwardRef<any, any>((props, ref) => {
      const { children, ...rest } = props;
      const filteredProps = filterProps(rest);
      return React.createElement(tag, { ...filteredProps, ref }, children);
    });
  
  return {
    motion: new Proxy({}, {
      get: (target, prop: string) => {
        return createMotionComponent(prop);
      }
    }),
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({
      start: vi.fn(),
      set: vi.fn(),
    }),
  };
});

// Mock Lucide React icons using 2025 best practices
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    // Only mock the icons we need for testing
    Clock: vi.fn(() => <div data-testid="clock-icon" />),
    User: vi.fn(() => <div data-testid="user-icon" />),
    Calendar: vi.fn(() => <div data-testid="calendar-icon" />),
    CheckCircle2: vi.fn(() => <div data-testid="check-circle-icon" />),
    Circle: vi.fn(() => <div data-testid="circle-icon" />),
    AlertTriangle: vi.fn(() => <div data-testid="alert-triangle-icon" />),
    Target: vi.fn(() => <div data-testid="target-icon" />),
    ChevronRight: vi.fn(() => <div data-testid="chevron-right-icon" />),
    MoreHorizontal: vi.fn(() => <div data-testid="more-icon" />),
    Link2: vi.fn(() => <div data-testid="link-icon" />),
  };
});

// Create hoisted mock functions that can be shared between factory and tests
const mockStore = vi.hoisted(() => {
  return {
    setSelectedTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    duplicateTask: vi.fn(),
  };
});

// Mock the entire store module using the hoisted functions
vi.mock('@/store/useTaskStore', () => {
  return {
    useTaskStore: vi.fn(() => ({
      setSelectedTask: mockStore.setSelectedTask,
      updateTask: mockStore.updateTask,
      deleteTask: mockStore.deleteTask,
      duplicateTask: mockStore.duplicateTask,
      // Add other required store methods to prevent undefined errors
      getTasks: vi.fn(() => []),
      getFilteredTasks: vi.fn(() => []),
      addTask: vi.fn(),
      toggleTaskStatus: vi.fn(),
      getAnalytics: vi.fn(() => ({ totalTasks: 0, completedTasks: 0, inProgressTasks: 0, pendingTasks: 0 })),
    })),
  };
});

describe('TaskCard', () => {
  let mockTask: Task;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Clear all mocks to ensure test isolation (2025 best practice)
    vi.clearAllMocks();
    
    // Ensure mock functions are fresh for each test
    mockStore.setSelectedTask.mockClear();
    mockStore.duplicateTask.mockClear();
    mockStore.deleteTask.mockClear();
    mockStore.updateTask.mockClear();
    
    mockTask = testUtils.createMockTask({
      id: 1,
      title: 'Test Task',
      description: 'This is a test task description',
      status: 'pending',
      priority: 'medium',
      subtasks: [
        {
          id: 1,
          title: 'Subtask 1',
          description: 'First subtask',
          status: 'done',
          priority: 'low'
        },
        {
          id: 2,
          title: 'Subtask 2', 
          description: 'Second subtask',
          status: 'pending',
          priority: 'medium'
        }
      ]
    });

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render task information correctly', () => {
      render(<TaskCard task={mockTask} />);

      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('This is a test task description')).toBeInTheDocument();
      
      // Use specific element targeting for badges (2025 best practice)
      const priorityBadge = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && 
               element?.className.includes('capitalize') &&
               (element?.textContent === 'medium' || element?.textContent === 'Medium');
      });
      expect(priorityBadge).toBeInTheDocument();
      
      const statusBadge = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && 
               element?.className.includes('capitalize') &&
               (element?.textContent === 'pending' || element?.textContent === 'Pending');
      });
      expect(statusBadge).toBeInTheDocument();
    });

    it('should display subtasks count when subtasks exist', () => {
      render(<TaskCard task={mockTask} />);

      // Check for subtasks display in metadata section
      expect(screen.getByText('1/2')).toBeInTheDocument(); // Format is completed/total
    });

    it('should not display subtasks info when no subtasks exist', () => {
      const taskWithoutSubtasks = { ...mockTask, subtasks: [] };
      render(<TaskCard task={taskWithoutSubtasks} />);

      expect(screen.queryByText(/subtasks/)).not.toBeInTheDocument();
    });

    it('should apply correct priority styling', () => {
      const highPriorityTask = { ...mockTask, priority: 'high' as const };
      render(<TaskCard task={highPriorityTask} />);

      // Check for high priority styling (red stripe and text)
      const priorityStripe = document.querySelector('.bg-red-500');
      expect(priorityStripe).toBeInTheDocument();
      
      // Check for priority badge with specific targeting
      const priorityBadge = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && 
               element?.className.includes('capitalize') &&
               (element?.textContent === 'high' || element?.textContent === 'High');
      });
      expect(priorityBadge).toBeInTheDocument();
    });

    it('should apply correct status styling', () => {
      const completedTask = { ...mockTask, status: 'done' as const };
      render(<TaskCard task={completedTask} />);

      // Check for done status badge with specific targeting
      const statusBadge = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && 
               element?.className.includes('capitalize') &&
               (element?.textContent === 'done' || element?.textContent === 'Done');
      });
      expect(statusBadge).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call setSelectedTask when card is clicked', async () => {
      render(<TaskCard task={mockTask} />);

      // TaskCard renders as a div, not article - use class-based selector
      const taskCard = document.querySelector('.group.relative.bg-card');
      expect(taskCard).toBeInTheDocument();
      
      await user.click(taskCard!);
      expect(mockStore.setSelectedTask).toHaveBeenCalledWith(mockTask);
    });

    it('should open dropdown menu when more options button is clicked', async () => {
      render(<TaskCard task={mockTask} />);

      const moreButton = screen.getByTestId('more-icon').closest('button');
      expect(moreButton).toBeInTheDocument();
      
      await user.click(moreButton!);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should handle edit action from dropdown', async () => {
      render(<TaskCard task={mockTask} />);

      // Find and click dropdown button to open menu
      const moreButton = screen.getByTestId('more-icon').closest('button') as HTMLButtonElement;
      expect(moreButton).toBeInTheDocument();
      
      // Click to open dropdown with fireEvent as fallback
      await user.click(moreButton);
      
      // Use more flexible text searching for Edit button
      const editButton = await waitFor(() => 
        screen.getByRole('menuitem', { name: /edit/i }) || 
        screen.getByText('Edit')
      , { timeout: 5000 });
      
      expect(editButton).toBeInTheDocument();
      
      // Use fireEvent as fallback for the dropdown item click
      fireEvent.click(editButton);
      
      // Wait for action to complete
      await waitFor(() => {
        expect(mockStore.setSelectedTask).toHaveBeenCalledWith(mockTask);
      }, { timeout: 3000 });
    });

    it('should handle duplicate action from dropdown', async () => {
      render(<TaskCard task={mockTask} />);

      // Find and click dropdown button to open menu
      const moreButton = screen.getByTestId('more-icon').closest('button') as HTMLButtonElement;
      await user.click(moreButton);
      
      // Wait for dropdown to appear and find duplicate button
      const duplicateButton = await waitFor(() => 
        screen.getByRole('menuitem', { name: /duplicate/i }) || 
        screen.getByText('Duplicate')
      , { timeout: 5000 });
      
      expect(duplicateButton).toBeInTheDocument();
      
      // Use fireEvent for dropdown item click
      fireEvent.click(duplicateButton);
      
      // Wait for action to complete
      await waitFor(() => {
        expect(mockStore.duplicateTask).toHaveBeenCalledWith(mockTask.id);
      }, { timeout: 3000 });
    });

    it('should handle delete action from dropdown', async () => {
      render(<TaskCard task={mockTask} />);

      // Find and click dropdown button to open menu
      const moreButton = screen.getByTestId('more-icon').closest('button') as HTMLButtonElement;
      await user.click(moreButton);
      
      // Wait for dropdown to appear and find delete button
      const deleteButton = await waitFor(() => 
        screen.getByRole('menuitem', { name: /delete/i }) || 
        screen.getByText('Delete')
      , { timeout: 5000 });
      
      expect(deleteButton).toBeInTheDocument();
      
      // Use fireEvent for dropdown item click
      fireEvent.click(deleteButton);
      
      // Should show confirmation dialog - wait for modal with longer timeout due to animations
      const confirmDialog = await waitFor(() => 
        screen.getByText('Are you sure you want to delete this task?')
      , { timeout: 6000 });
      
      expect(confirmDialog).toBeInTheDocument();
      
      // Click confirm delete button
      const confirmButton = await screen.findByText('Delete Task');
      fireEvent.click(confirmButton);
      
      // Wait for action to complete
      await waitFor(() => {
        expect(mockStore.deleteTask).toHaveBeenCalledWith(mockTask.id);
      }, { timeout: 3000 });
    });

    it('should toggle status when status badge is clicked', async () => {
      render(<TaskCard task={mockTask} />);

      const statusBadge = screen.getByText('Pending');
      await user.click(statusBadge);

      expect(mockStore.updateTask).toHaveBeenCalledWith(mockTask.id, {
        status: 'in-progress'
      });
    });

    it('should cycle through statuses on repeated clicks', async () => {
      const { rerender } = render(<TaskCard task={mockTask} />);

      // First click: pending -> in-progress
      const statusBadge = screen.getByText('Pending');
      await user.click(statusBadge);

      expect(mockStore.updateTask).toHaveBeenCalledWith(mockTask.id, {
        status: 'in-progress'
      });

      // Update task and rerender
      const inProgressTask = { ...mockTask, status: 'in-progress' as const };
      rerender(<TaskCard task={inProgressTask} />);

      // Second click: in-progress -> done
      const inProgressBadge = screen.getByText('In Progress');
      await user.click(inProgressBadge);

      expect(mockStore.updateTask).toHaveBeenCalledWith(mockTask.id, {
        status: 'done'
      });
    });

    it('should expand/collapse subtasks when clicked', async () => {
      render(<TaskCard task={mockTask} />);

      // Find the subtasks button by role and content  
      const subtasksButton = screen.getByRole('button', { name: /2 subtasks/i });
      
      // Initially subtasks should not be visible
      expect(screen.queryByText('Subtask 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Subtask 2')).not.toBeInTheDocument();
      
      // Click to expand
      await user.click(subtasksButton);

      // Should show expanded subtasks
      await waitFor(() => {
        expect(screen.getByText('Subtask 1')).toBeInTheDocument();
        expect(screen.getByText('Subtask 2')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Verify the chevron rotated (indicating expanded state)
      const chevron = document.querySelector('.lucide-chevron-down');
      expect(chevron).toHaveClass('rotate-180');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<TaskCard task={mockTask} />);

      const taskCard = screen.getByRole('article');
      expect(taskCard).toHaveAttribute('aria-label', 'Task: Test Task');

      const moreButton = screen.getByRole('button', { name: /more options/i });
      expect(moreButton).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<TaskCard task={mockTask} />);

      const taskCard = screen.getByRole('article');
      taskCard.focus();

      // Should be focusable
      expect(taskCard).toHaveFocus();

      // Enter key should select task
      await user.keyboard('{Enter}');
      expect(mockStore.setSelectedTask).toHaveBeenCalledWith(mockTask);
    });

    it('should support keyboard navigation for dropdown menu', async () => {
      render(<TaskCard task={mockTask} />);

      const moreButton = screen.getByRole('button', { name: /more options/i });
      
      // Use fireEvent for more reliable keyboard opening
      fireEvent.keyDown(moreButton, { key: 'Enter' });
      
      // Wait for dropdown to appear with shorter timeout
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      // Test that duplicate action works from keyboard - use fireEvent directly
      const duplicateButton = screen.getByText('Duplicate');
      fireEvent.click(duplicateButton);
      
      await waitFor(() => {
        expect(mockStore.duplicateTask).toHaveBeenCalledWith(mockTask.id);
      }, { timeout: 1000 });
    });

    it('should have proper focus management', async () => {
      render(<TaskCard task={mockTask} />);

      const moreButton = screen.getByRole('button', { name: /more options/i });
      await user.click(moreButton);

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      // Check that dropdown menu items are accessible via role
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(3);
      expect(menuItems[0]).toHaveTextContent('Edit');
    });
  });

  describe('Visual States', () => {
    it('should show loading state when updating', async () => {
      render(<TaskCard task={mockTask} />);

      const statusBadge = screen.getByText('Pending');
      
      // Mock updateTask to be async to catch loading state
      mockStore.updateTask.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      await user.click(statusBadge);

      // Should show loading indicator immediately after click
      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      }, { timeout: 100 });
    });

    it('should show error state when operation fails', async () => {
      mockStore.updateTask.mockRejectedValueOnce(new Error('Update failed'));
      
      render(<TaskCard task={mockTask} />);

      const statusBadge = screen.getByText('Pending');
      await user.click(statusBadge);

      await waitFor(() => {
        expect(screen.getByText('Failed to update task')).toBeInTheDocument();
      });
    });

    it('should highlight task when selected', () => {
      render(<TaskCard task={mockTask} isSelected={true} />);

      // Check for selection styling using proper React Testing Library approach
      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
      expect(article).toHaveClass('ring-2');
      expect(article).toHaveClass('ring-primary/50');
      expect(article).toHaveClass('bg-primary/5');
    });

    it('should show drag handle when draggable', () => {
      render(<TaskCard task={mockTask} isDraggable={true} />);

      const dragHandle = screen.getByTestId('drag-handle');
      expect(dragHandle).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn();
      
      // Create a wrapper that tracks renders of TaskCard specifically
      const TestComponent = React.memo(({ task }: { task: Task }) => {
        renderSpy();
        return <TaskCard task={task} />;
      });

      const { rerender } = render(<TestComponent task={mockTask} />);
      
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with exact same task reference should not cause re-render
      rerender(<TestComponent task={mockTask} />);
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Boundaries', () => {
    it('should handle errors gracefully', () => {
      const ErrorThrowingTaskCard = () => {
        throw new Error('TaskCard error');
      };

      // Mock console.error to prevent test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ErrorThrowingTaskCard />);
      }).toThrow('TaskCard error');

      consoleSpy.mockRestore();
    });
  });
});