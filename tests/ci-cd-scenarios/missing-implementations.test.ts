/**
 * CI/CD Test Scenario 2: Missing Implementations
 * This file contains abstract classes and interfaces with missing implementations
 */

// Test 1: Abstract class with missing implementation
abstract class BaseTaskManager {
  abstract createTask(title: string): void;
  abstract deleteTask(id: number): void;
  
  updateTask(id: number, updates: any): void {
    console.log(`Updating task ${id}`);
  }
}

// ❌ ERROR: Non-abstract class 'TaskManager' does not implement inherited abstract member 'createTask'
class TaskManager extends BaseTaskManager {
  // Missing createTask implementation
  
  deleteTask(id: number): void {
    console.log(`Deleting task ${id}`);
  }
}

// Test 2: Interface implementation with missing methods
interface ITaskService {
  getAllTasks(): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | null>;
  createTask(task: Omit<Task, 'id'>): Promise<Task>;
  updateTask(id: number, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
}

// ❌ ERROR: Class 'IncompleteTaskService' incorrectly implements interface 'ITaskService'
// Missing: getAllTasks, updateTask
class IncompleteTaskService implements ITaskService {
  async getTaskById(id: number): Promise<Task | null> {
    return null;
  }
  
  async createTask(task: Omit<Task, 'id'>): Promise<Task> {
    return { ...task, id: Date.now() } as Task;
  }
  
  async deleteTask(id: number): Promise<void> {
    console.log(`Deleted task ${id}`);
  }
  // Missing getAllTasks and updateTask implementations
}

// Test 3: Generic interface with missing type parameter constraints
interface Repository<T> {
  findAll(): Promise<T[]>;
  findById(id: number): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: number): Promise<void>;
}

// ❌ ERROR: Type 'string' does not satisfy the constraint
// Assuming we add a constraint later: interface Repository<T extends { id: number }>
class StringRepository implements Repository<string> {
  async findAll(): Promise<string[]> {
    return [];
  }
  
  async findById(id: number): Promise<string | null> {
    return null;
  }
  
  async save(entity: string): Promise<string> {
    return entity;
  }
  
  async delete(id: number): Promise<void> {
    return;
  }
}

// Test 4: Promise/Async function signature mismatches
interface AsyncTaskOperations {
  loadTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
}

class BadAsyncImplementation implements AsyncTaskOperations {
  // ❌ ERROR: Property 'loadTasks' in type 'BadAsyncImplementation' is not assignable
  // Missing Promise return type
  loadTasks(): Task[] {
    return [];
  }
  
  // ❌ ERROR: Type '() => void' is not assignable to type '(task: Task) => Promise<void>'
  saveTask(): void {
    console.log('Saving...');
  }
}

// Test 5: React component with missing required props implementation
import React from 'react';

interface TaskCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (id: number) => void;
  className?: string;
}

// ❌ ERROR: JSX element type 'BadTaskCard' does not have any construct or call signatures
// Missing proper React.FC implementation
const BadTaskCard = (props) => {
  // Missing type annotations and proper prop destructuring
  return <div>{props.task.title}</div>;
};

// Usage that will fail
export const TestComponent = () => {
  // ❌ ERROR: Property 'onUpdate' is missing in type '{ task: any; }'
  return <BadTaskCard task={{ id: 1, title: 'Test' }} />;
};