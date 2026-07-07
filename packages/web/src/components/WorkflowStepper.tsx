export type WorkflowStepStatus = 'complete' | 'active' | 'upcoming' | 'blocked';

export interface WorkflowStep {
  id: string;
  label: string;
  description?: string;
  status: WorkflowStepStatus;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  orientation?: 'horizontal' | 'vertical';
}

/**
 * A numbered step progress indicator, built for Go-Live Readiness / onboarding
 * flows where an owner needs to see exactly what's done, what's next, and
 * what's blocked. Purely presentational (no navigation); the checklist
 * itself decides what "complete"/"blocked" means.
 */
export function WorkflowStepper({ steps, orientation = 'horizontal' }: WorkflowStepperProps) {
  return (
    <ol className="workflow-stepper" data-orientation={orientation}>
      {steps.map((step, i) => (
        <li
          key={step.id}
          className="workflow-stepper__step"
          data-status={step.status}
          aria-current={step.status === 'active' ? 'step' : undefined}
        >
          <span className="workflow-stepper__marker" aria-hidden="true">
            {step.status === 'complete' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              i + 1
            )}
          </span>
          <span className="workflow-stepper__text">
            <span className="workflow-stepper__label">{step.label}</span>
            {step.description && <span className="workflow-stepper__description">{step.description}</span>}
          </span>
          {i < steps.length - 1 && <span className="workflow-stepper__connector" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
