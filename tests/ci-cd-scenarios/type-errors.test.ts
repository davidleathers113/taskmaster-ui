/**
 * CI/CD Test Scenario 1: Type Errors - Missing Properties
 * This file contains various type errors that should be caught by TypeScript
 */

import { Task, Subtask, FilterOptions } from '@types/index';

// Test 1: Missing required properties
export const testMissingProperties = () => {
  // ❌ ERROR: Missing required properties: description, details, testStrategy, priority, etc.
  const invalidTask: Task = {
    id: 1,
    title: 'Test Task'
  };

  // ❌ ERROR: Type 'string' is not assignable to type 'pending' | 'in-progress' | ...
  const taskWithInvalidStatus: Task = {
    id: 2,
    title: 'Another Task',
    description: 'Description',
    details: 'Details',
    testStrategy: 'Test',
    priority: 'low',
    dependencies: [],
    status: 'invalid-status', // Invalid status value
    subtasks: []
  };

  return { invalidTask, taskWithInvalidStatus };
};

// Test 2: Incorrect property types
export const testIncorrectTypes = () => {
  // ❌ ERROR: Type 'string' is not assignable to type 'number'
  const taskWithStringId: Task = {
    id: '123', // Should be number
    title: 'Test',
    description: 'Test',
    details: 'Test',
    testStrategy: 'Test',
    priority: 'medium',
    dependencies: [],
    status: 'pending',
    subtasks: []
  };

  // ❌ ERROR: Type 'number[]' is not assignable to type 'Subtask[]'
  const taskWithInvalidSubtasks: Task = {
    id: 3,
    title: 'Test',
    description: 'Test',
    details: 'Test',
    testStrategy: 'Test',
    priority: 'high',
    dependencies: [],
    status: 'done',
    subtasks: [1, 2, 3] // Should be Subtask objects
  };

  return { taskWithStringId, taskWithInvalidSubtasks };
};

// Test 3: Null/undefined issues with strict null checks
export const testStrictNullChecks = () => {
  let possiblyNullTask: Task | null = null;
  
  // ❌ ERROR: Object is possibly 'null'
  console.log(possiblyNullTask.title);

  const tasks: Task[] = [];
  const firstTask = tasks.find(t => t.id === 1);
  
  // ❌ ERROR: Object is possibly 'undefined'
  console.log(firstTask.description);

  // ❌ ERROR: Argument of type 'undefined' is not assignable to parameter of type 'Task'
  function processTask(task: Task): void {
    console.log(task.title);
  }
  
  processTask(undefined);
};

// Test 4: Interface extension issues
interface ExtendedTask extends Task {
  customField: string;
  // ❌ ERROR: Property 'status' in type 'ExtendedTask' is not assignable to the same property in base type 'Task'
  status: 'custom-status';
}

// Test 5: Array method type issues with noUncheckedIndexedAccess
export const testArrayIndexAccess = () => {
  const tasks: Task[] = [];
  
  // With noUncheckedIndexedAccess, this should be Task | undefined
  const task = tasks[0];
  
  // ❌ ERROR: Object is possibly 'undefined'
  console.log(task.title);
  
  // ❌ ERROR: Property 'nonExistentMethod' does not exist on type 'Task[]'
  tasks.nonExistentMethod();
};