/**
 * CI/CD Test Scenario 5: Complex Interface and Type Composition Errors
 * This file tests TypeScript's handling of complex interface scenarios
 */

import { Task, Subtask, FilterOptions, ViewMode } from '@types/index';

// Test 1: Interface merge conflicts
interface User {
  id: number;
  name: string;
}

interface User {
  // ❌ ERROR: Subsequent property declarations must have the same type
  id: string; // Conflicts with number type above
  email: string;
}

// Test 2: Complex generic constraints with multiple conditions
interface Repository<T extends { id: number } & { createdAt: Date }> {
  find(id: number): T | null;
}

// ❌ ERROR: Type 'SimpleItem' does not satisfy the constraint
interface SimpleItem {
  id: number;
  // Missing createdAt: Date
}

class ItemRepository implements Repository<SimpleItem> {
  find(id: number): SimpleItem | null {
    return null;
  }
}

// Test 3: Intersection types creating impossible types
type ImpossibleType = string & number;
// ❌ ERROR: Type 'string' is not assignable to type 'never'
const impossible: ImpossibleType = "hello";

// Test 4: Discriminated unions with overlapping discriminators
type Action = 
  | { type: 'CREATE'; payload: { task: Task } }
  | { type: 'UPDATE'; payload: { id: number; updates: Partial<Task> } }
  | { type: 'CREATE'; payload: { subtask: Subtask } }; // ❌ Duplicate discriminator

function handleAction(action: Action) {
  switch (action.type) {
    case 'CREATE':
      // ❌ TypeScript can't determine which CREATE action this is
      console.log(action.payload.task); // Property 'task' does not exist
      break;
  }
}

// Test 5: Excessive interface inheritance creating conflicts
interface BaseEntity {
  id: number;
  createdAt: string;
}

interface Timestamped {
  createdAt: Date; // Different type than BaseEntity
  updatedAt: Date;
}

interface Versioned {
  version: number;
  updatedAt: string; // Different type than Timestamped
}

// ❌ ERROR: Interface 'ComplexEntity' cannot simultaneously extend types
interface ComplexEntity extends BaseEntity, Timestamped, Versioned {
  name: string;
}

// Test 6: Mutually recursive interfaces without proper base case
interface TreeNode {
  value: string;
  // ❌ ERROR: children property creates infinite depth
  children: TreeNode[]; // This is actually valid, but usage can cause issues
}

// This creates type checking performance issues
type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// ❌ Applying to TreeNode can cause excessive recursion
type ReadonlyTree = DeepReadonly<TreeNode>;

// Test 7: Index signatures conflicting with known properties
interface ConfigurableTask extends Task {
  // ❌ ERROR: Property 'id' of type 'number' is not assignable to string index type 'string'
  [key: string]: string; // This conflicts with number properties like id
}

// Test 8: Nested partial types losing required constraints
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type PartialTask = DeepPartial<Task>;

function updateTask(updates: PartialTask) {
  // ❌ All properties are optional, losing type safety
  // Can't guarantee any property exists
  console.log(updates.id.toString()); // Object is possibly undefined
}

// Test 9: Overloaded function interfaces with incompatible signatures
interface TaskProcessor {
  process(task: Task): void;
  process(id: number): void;
  // ❌ ERROR: Overload signatures must all be compatible
  process(tasks: Task[]): string; // Different return type
}

// Test 10: Complex mapped type with conditional nested properties
type ComplexMapped<T> = {
  [K in keyof T]: T[K] extends object 
    ? T[K] extends any[] 
      ? T[K]
      : ComplexMapped<T[K]> & { _metadata?: string }
    : T[K] | null;
};

// ❌ This can create types that are too complex for TypeScript to handle efficiently
type MappedTask = ComplexMapped<Task>;

// Test 11: Mixins with conflicting property types
interface Trackable {
  track(): void;
  status: 'active' | 'inactive';
}

interface Manageable {
  manage(): void;
  status: 'managed' | 'unmanaged';
}

// ❌ ERROR: Property 'status' must be of type '"active" | "inactive"'
class TrackedTask implements Task, Trackable, Manageable {
  // Attempting to implement all interfaces creates conflicts
  status: 'active'; // Can't satisfy both Trackable and Manageable
  
  // ... rest of implementation
}