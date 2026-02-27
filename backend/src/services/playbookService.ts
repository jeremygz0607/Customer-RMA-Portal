import { getActivePlaybook } from '../repositories/rmaPlaybookRepo';
import { TroubleshootingData } from '../repositories/rmaTroubleshootingRepo';

export interface PlaybookStep {
  id: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  requiresEvidence?: boolean;
  branching?: {
    condition: string;
    nextStepId?: string;
    end?: boolean;
  }[];
}

export interface Playbook {
  steps: PlaybookStep[];
  metadata?: {
    name?: string;
    version?: number;
  };
}

export async function getPlaybookForSkuGroup(
  skuGroupName: string,
): Promise<Playbook | null> {
  const playbook = await getActivePlaybook(skuGroupName);
  if (!playbook) {
    return null;
  }

  return {
    steps: playbook.playbookJson.steps || [],
    metadata: {
      name: skuGroupName,
      version: playbook.version,
    },
  };
}

export function getNextStep(
  playbook: Playbook,
  currentStepId: string | null,
  completedSteps: any[],
  stepAnswers?: Record<string, any>,
): PlaybookStep | null {
  if (!playbook.steps || playbook.steps.length === 0) {
    return null;
  }

  // If no current step, return first step
  if (!currentStepId) {
    return playbook.steps[0];
  }

  // Find current step
  const currentStepIndex = playbook.steps.findIndex((s) => s.id === currentStepId);
  if (currentStepIndex === -1) {
    return null;
  }

  const currentStep = playbook.steps[currentStepIndex];

  // Check branching logic
  if (currentStep.branching && stepAnswers) {
    const answer = stepAnswers[currentStepId];
    for (const branch of currentStep.branching) {
      if (branch.condition === 'pass' && answer === 'pass') {
        if (branch.end) {
          return null; // End of flow
        }
        if (branch.nextStepId) {
          return playbook.steps.find((s) => s.id === branch.nextStepId) || null;
        }
      }
      if (branch.condition === 'fail' && answer === 'fail') {
        if (branch.end) {
          return null;
        }
        if (branch.nextStepId) {
          return playbook.steps.find((s) => s.id === branch.nextStepId) || null;
        }
      }
    }
  }

  // Default: next step in sequence
  if (currentStepIndex < playbook.steps.length - 1) {
    return playbook.steps[currentStepIndex + 1];
  }

  return null; // End of steps
}

export function isPlaybookComplete(
  playbook: Playbook,
  completedSteps: any[],
): boolean {
  if (!playbook.steps || playbook.steps.length === 0) {
    return true;
  }

  const completedStepIds = completedSteps.map((s: any) => s.stepId);
  return playbook.steps.every((step) => completedStepIds.includes(step.id));
}
