/**
 * CI/CD Test Scenario 4: Conditional Types and Advanced Type Issues
 * This file tests TypeScript's handling of conditional types and generic constraints
 */

import { Task, Subtask } from '@types/index';

// Test 1: Conditional type that doesn't properly narrow
type TaskOrSubtask<T> = T extends { taskId: number } ? Subtask : Task;

// ❌ ERROR: Type 'string' is not assignable to type 'Task'
const wrongType: TaskOrSubtask<string> = "not a task";

// Test 2: Incorrect conditional type usage
type ExtractStatus<T> = T extends { status: infer S } ? S : never;

// ❌ ERROR: Type '"invalid"' is not assignable to type 'never' 
const invalidStatus: ExtractStatus<{ notStatus: string }> = "invalid";

// Test 3: Template literal types with invalid patterns
type TaskAction = `${string}_TASK`;
type InvalidAction = "INVALID"; // This doesn't match the pattern

// ❌ ERROR: Type '"INVALID"' is not assignable to type '`${string}_TASK`'
const action: TaskAction = "INVALID" as InvalidAction;

// Test 4: Distributive conditional types behaving unexpectedly
type IsArray<T> = T extends any[] ? true : false;
type TestUnion = IsArray<string | number[]>; // Results in boolean, not true | false as might be expected

// ❌ ERROR: This will cause issues when expecting specific boolean literals
const mustBeTrue: true = {} as TestUnion;

// Test 5: Mapped types with incorrect key constraints
type TaskKeys = keyof Task;
type WrongMapped = {
  // ❌ ERROR: A mapped type may not declare properties or methods
  [K in TaskKeys]: Task[K];
  extraProperty: string; // Can't add extra properties to mapped types
};

// Test 6: Recursive type issues without proper base case
type InfiniteNesting<T> = {
  // ❌ ERROR: Type alias 'InfiniteNesting' circularly references itself
  value: T;
  nested: InfiniteNesting<InfiniteNesting<T>>;
};

// Test 7: Using 'this' type incorrectly
class TaskBuilder {
  private task: Partial<Task> = {};
  
  setTitle(title: string): this {
    this.task.title = title;
    // ❌ ERROR: Type 'TaskBuilder' is not assignable to type 'this'
    return new TaskBuilder();
  }
}

// Test 8: Const assertions used incorrectly
const taskStatus = {
  PENDING: 'pending',
  DONE: 'done'
} as const;

// ❌ ERROR: Cannot assign to 'PENDING' because it is a read-only property
taskStatus.PENDING = 'in-progress';

// Test 9: Type predicates that lie
function isTask(value: unknown): value is Task {
  // ❌ This predicate always returns true, lying about the type
  return true;
}

const notReallyATask = "string";
if (isTask(notReallyATask)) {
  // TypeScript thinks this is safe, but it will crash at runtime
  console.log(notReallyATask.id);
}

// Test 10: Extract and Exclude utility types misuse
type TaskStatus = Task['status'];
type ExcludeStatus = Exclude<TaskStatus, 'pending' | 'done'>;

// ❌ ERROR: Argument of type 'TaskStatus' is not assignable to parameter of type 'ExcludeStatus'
function processNonPendingStatus(status: ExcludeStatus) {
  console.log(status);
}

const anyStatus: TaskStatus = 'pending';
processNonPendingStatus(anyStatus); // This includes excluded values

// Test 11: Branded types without proper guards
declare const brand: unique symbol;
type UserId = string & { [brand]: 'UserId' };

// ❌ ERROR: Type 'string' is not assignable to type 'UserId'
const userId: UserId = "user123"; // Can't assign string directly to branded type

// Test 12: Variance issues with function parameters
interface Container<T> {
  value: T;
  setValue: (val: T) => void;
}

declare let taskContainer: Container<Task>;
declare let subtaskContainer: Container<Subtask>;

// ❌ ERROR: Type 'Container<Subtask>' is not assignable to type 'Container<Task>'
// Even though Subtask extends Task, Container<Subtask> is not assignable to Container<Task>
taskContainer = subtaskContainer;