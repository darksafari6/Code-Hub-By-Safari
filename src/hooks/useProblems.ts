import { useEffect, useState } from 'react';
import { monaco } from '../lib/monaco';
import type { EditorProblem } from '../lib/types';

const SEVERITY_LABEL: Record<number, EditorProblem['severity']> = {
  [monaco.MarkerSeverity.Error]: 'error',
  [monaco.MarkerSeverity.Warning]: 'warning',
  [monaco.MarkerSeverity.Info]: 'info',
  [monaco.MarkerSeverity.Hint]: 'info',
};

export interface ProblemCounts {
  errors: number;
  warnings: number;
}

export function useProblems(): { problems: EditorProblem[]; counts: ProblemCounts } {
  const [problems, setProblems] = useState<EditorProblem[]>([]);

  useEffect(() => {
    const update = () => {
      const next = monaco.editor
        .getModelMarkers({})
        .filter((marker) => marker.severity >= monaco.MarkerSeverity.Warning)
        .map<EditorProblem>((marker) => ({
          path: marker.resource.path.replace(/^\/+/, ''),
          line: marker.startLineNumber,
          column: marker.startColumn,
          message: marker.message,
          severity: SEVERITY_LABEL[marker.severity] ?? 'info',
        }));
      setProblems(next);
    };

    update();
    const disposable = monaco.editor.onDidChangeMarkers(update);
    return () => disposable.dispose();
  }, []);

  const counts = problems.reduce<ProblemCounts>(
    (accumulator, problem) => {
      if (problem.severity === 'error') accumulator.errors += 1;
      if (problem.severity === 'warning') accumulator.warnings += 1;
      return accumulator;
    },
    { errors: 0, warnings: 0 },
  );

  return { problems, counts };
}
