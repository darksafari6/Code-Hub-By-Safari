export interface Agent {
  name: string;
  role: string;
  execute(task: string, context: any): Promise<any>;
}

export class PlannerAgent implements Agent {
  name = 'Planner';
  role = 'Breaks down user goals into structured plans';
  
  async execute(task: string, context: any) {
    // Implement using Gemini API
    return { plan: ['Step 1', 'Step 2'] };
  }
}

export class ExecutorAgent implements Agent {
  name = 'Executor';
  role = 'Performs file operations and writes code';
  
  async execute(task: string, context: any) {
    return { status: 'executed' };
  }
}

export class DebuggerAgent implements Agent {
  name = 'Debugger';
  role = 'Detects syntax/runtime errors and fixes them';
  
  async execute(task: string, context: any) {
    return { status: 'debugged' };
  }
}

export class ReviewerAgent implements Agent {
  name = 'Reviewer';
  role = 'Improves performance and code quality';
  
  async execute(task: string, context: any) {
    return { status: 'reviewed' };
  }
}

export class TesterAgent implements Agent {
  name = 'Tester';
  role = 'Generates test cases and runs tests';
  
  async execute(task: string, context: any) {
    return { status: 'tested' };
  }
}

export class DevOpsAgent implements Agent {
  name = 'DevOps';
  role = 'Handles deployment and Docker configs';
  
  async execute(task: string, context: any) {
    return { status: 'deployed' };
  }
}
