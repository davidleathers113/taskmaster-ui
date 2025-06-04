#!/usr/bin/env node
/**
 * generate-tasks.js - Generate TaskMaster tasks.json for specific worktrees
 * Extracts relevant tasks/subtasks from main branch based on worktree focus
 */

import fs from 'fs';
import path from 'path';

/**
 * Generate worktree-specific tasks.json based on task configuration
 * @param {Object} taskConfig - Task definition from wt_config.json
 * @param {Object} mainTasks - Full tasks.json from main branch
 */
function generateWorktreeTasks(taskConfig, mainTasks) {
    const { id: taskId, name, description, errorTypes, category, metrics } = taskConfig;
    
    // Create base task structure
    const worktreeTask = {
        id: 1,
        title: name,
        description: description,
        details: generateTaskDetails(taskConfig),
        testStrategy: generateTestStrategy(taskConfig),
        priority: taskConfig.priority || "high",
        dependencies: [],
        status: "pending",
        subtasks: []
    };

    // Generate subtasks based on error types and metrics
    let subtaskId = 1;
    
    if (errorTypes && errorTypes.length > 0) {
        errorTypes.forEach(errorType => {
            const subtask = generateErrorTypeSubtask(subtaskId++, errorType, taskConfig);
            worktreeTask.subtasks.push(subtask);
        });
    }

    // Add analysis subtask
    worktreeTask.subtasks.push({
        id: subtaskId++,
        title: `Analyze ${category} patterns`,
        description: `Identify patterns and root causes for ${category} issues in the codebase`,
        dependencies: [],
        details: `Use tree-sitter tools and static analysis to understand the scope and patterns of issues. Document findings for systematic resolution.`,
        status: "pending"
    });

    // Add verification subtask
    worktreeTask.subtasks.push({
        id: subtaskId++,
        title: "Verify fixes and run tests",
        description: "Ensure all fixes are working correctly and don't introduce regressions",
        dependencies: Array.from({ length: subtaskId - 2 }, (_, i) => i + 1),
        details: "Run typecheck, lint, and test suites to verify fixes. Check that error counts have decreased as expected.",
        status: "pending"
    });

    // Add progress tracking subtask
    worktreeTask.subtasks.push({
        id: subtaskId++,
        title: "Update progress tracking", 
        description: "Document progress and findings in coordination files",
        dependencies: [subtaskId - 2], // Previous subtask (verification)
        details: "Update wt_tasks/progress.md with findings, metrics, and any cross-worktree coordination needed.",
        status: "pending"
    });

    return {
        tasks: [worktreeTask],
        metadata: {
            worktreeId: taskId,
            generatedAt: new Date().toISOString(),
            originalTasksVersion: mainTasks.metadata?.version || "unknown",
            errorTypes: errorTypes || [],
            expectedMetrics: metrics || {}
        }
    };
}

/**
 * Generate detailed task description
 */
function generateTaskDetails(taskConfig) {
    const { errorTypes, metrics, estimatedDuration } = taskConfig;
    
    let details = `This worktree focuses on: ${taskConfig.description}\n\n`;
    
    if (errorTypes && errorTypes.length > 0) {
        details += `**Target Error Types:**\n`;
        errorTypes.forEach(type => {
            details += `- ${type}: ${getErrorTypeDescription(type)}\n`;
        });
        details += `\n`;
    }
    
    if (metrics) {
        details += `**Expected Metrics:**\n`;
        Object.entries(metrics).forEach(([key, value]) => {
            details += `- ${key}: ${value}\n`;
        });
        details += `\n`;
    }
    
    if (estimatedDuration) {
        details += `**Estimated Duration:** ${estimatedDuration}\n\n`;
    }
    
    details += `**Workflow:**\n`;
    details += `1. Run initial analysis: \`npm run typecheck\` and \`npm run lint\`\n`;
    details += `2. Use tree-sitter tools to identify patterns\n`;
    details += `3. Fix issues systematically, committing frequently\n`;
    details += `4. Verify fixes don't introduce new errors\n`;
    details += `5. Update progress tracking\n`;
    details += `6. Create PR when complete\n`;
    
    return details;
}

/**
 * Generate test strategy based on task configuration
 */
function generateTestStrategy(taskConfig) {
    const { category, errorTypes } = taskConfig;
    
    let strategy = `Verify that ${category} issues are resolved through:\n`;
    strategy += `- TypeScript compilation passes without targeted error types\n`;
    strategy += `- ESLint shows reduced error/warning counts\n`;
    strategy += `- Existing tests continue to pass\n`;
    strategy += `- Application builds and runs correctly\n`;
    
    if (errorTypes && errorTypes.includes('TS2307')) {
        strategy += `- All module imports resolve correctly\n`;
    }
    if (errorTypes && errorTypes.includes('TS2532')) {
        strategy += `- No null/undefined access violations\n`;
    }
    if (errorTypes && errorTypes.some(t => t.startsWith('TS2'))) {
        strategy += `- Type safety is maintained throughout\n`;
    }
    
    return strategy;
}

/**
 * Generate subtask for specific error type
 */
function generateErrorTypeSubtask(id, errorType, taskConfig) {
    const description = getErrorTypeDescription(errorType);
    const estimatedCount = getEstimatedErrorCount(errorType, taskConfig.metrics);
    
    return {
        id: id,
        title: `Fix ${errorType} errors`,
        description: `Resolve ${errorType} (${description}) errors throughout the codebase`,
        dependencies: [],
        details: `Target: ~${estimatedCount} errors of type ${errorType}\n\nProcess:\n1. Identify all ${errorType} errors: \`npm run typecheck | grep ${errorType}\`\n2. Analyze patterns and root causes\n3. Implement systematic fixes\n4. Verify fixes with incremental type checking\n5. Commit changes with conventional commit messages`,
        status: "pending"
    };
}

/**
 * Get human-readable description for TypeScript error codes
 */
function getErrorTypeDescription(errorType) {
    const descriptions = {
        'TS2307': 'Cannot find module',
        'TS2484': 'Export assignment conflicts',
        'TS7006': 'Implicit any parameter',
        'TS2532': 'Object possibly null/undefined',
        'TS2345': 'Type assignment error',
        'TS2322': 'Type incompatibility',
        'TS2339': 'Property does not exist',
        'TS6133': 'Unused declaration'
    };
    return descriptions[errorType] || 'TypeScript error';
}

/**
 * Estimate error count based on metrics and error type
 */
function getEstimatedErrorCount(errorType, metrics) {
    if (!metrics) return '?';
    
    // For module errors, estimate based on total error count
    if (errorType === 'TS2307' || errorType === 'TS2484') {
        return Math.floor((metrics.errorCount || 0) * 0.6); // ~60% are usually module errors
    }
    
    // For type safety errors, distribute remaining
    const remainingTypes = ['TS7006', 'TS2532', 'TS2345', 'TS2322'];
    if (remainingTypes.includes(errorType)) {
        return Math.floor((metrics.errorCount || 0) * 0.1); // ~10% each
    }
    
    return Math.floor((metrics.errorCount || 0) * 0.05); // ~5% for others
}

/**
 * Main execution
 */
function main() {
    const [,, taskConfigPath, mainTasksPath, worktreePath] = process.argv;
    
    if (!taskConfigPath || !mainTasksPath || !worktreePath) {
        console.error('Usage: node generate-tasks.js <task-config.json> <main-tasks.json> <worktree-path>');
        process.exit(1);
    }
    
    try {
        const taskConfig = JSON.parse(fs.readFileSync(taskConfigPath, 'utf8'));
        const mainTasks = JSON.parse(fs.readFileSync(mainTasksPath, 'utf8'));
        
        const worktreeTasks = generateWorktreeTasks(taskConfig, mainTasks);
        
        // Ensure .taskmaster/tasks directory exists
        const tasksDir = path.join(worktreePath, '.taskmaster', 'tasks');
        fs.mkdirSync(tasksDir, { recursive: true });
        
        // Write tasks.json
        const tasksPath = path.join(tasksDir, 'tasks.json');
        fs.writeFileSync(tasksPath, JSON.stringify(worktreeTasks, null, 2));
        
        console.log(`Generated tasks.json for worktree at: ${tasksPath}`);
        console.log(`- Task: ${worktreeTasks.tasks[0].title}`);
        console.log(`- Subtasks: ${worktreeTasks.tasks[0].subtasks.length}`);
        console.log(`- Error Types: ${worktreeTasks.metadata.errorTypes.join(', ')}`);
        
    } catch (error) {
        console.error('Error generating tasks:', error.message);
        process.exit(1);
    }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { generateWorktreeTasks };