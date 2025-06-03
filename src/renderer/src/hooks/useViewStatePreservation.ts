import { useEffect, useCallback } from 'react';
import { saveViewState, loadViewState, type ViewState } from '@/utils/statePreservation';

/**
 * Custom hook for view state preservation in React components
 * Automatically saves and loads component state to survive errors and crashes
 */
export function useViewStatePreservation<T extends ViewState>(
  viewName: string,
  currentState: T,
  dependencies: any[] = []
) {
  // Save state whenever dependencies change
  useEffect(() => {
    if (Object.keys(currentState).length > 0) {
      saveViewState(viewName, currentState);
    }
  }, dependencies);

  // Load saved state function
  const loadSavedState = useCallback((): T | null => {
    return loadViewState<T>(viewName);
  }, [viewName]);

  // Manual save function
  const saveCurrentState = useCallback((stateToSave?: T) => {
    const state = stateToSave || currentState;
    return saveViewState(viewName, state);
  }, [viewName, currentState]);

  return {
    loadSavedState,
    saveCurrentState
  };
}

/**
 * Example usage in a view component:
 * 
 * ```typescript
 * const TaskListView = () => {
 *   const [viewState, setViewState] = useState({
 *     sortBy: 'priority',
 *     filterStatus: 'all',
 *     selectedTasks: []
 *   });
 * 
 *   const { loadSavedState, saveCurrentState } = useViewStatePreservation(
 *     'taskList',
 *     viewState,
 *     [viewState] // Dependencies that trigger auto-save
 *   );
 * 
 *   // Load saved state on mount
 *   useEffect(() => {
 *     const savedState = loadSavedState();
 *     if (savedState) {
 *       setViewState(prev => ({ ...prev, ...savedState }));
 *     }
 *   }, []);
 * 
 *   // Manual save before risky operations
 *   const handleBulkOperation = () => {
 *     saveCurrentState(); // Backup before bulk operation
 *     // ... perform bulk operation
 *   };
 * 
 *   return (
 *     // Component JSX
 *   );
 * };
 * ```
 */