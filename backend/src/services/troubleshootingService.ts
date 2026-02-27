import { getRmaRequest } from '../repositories/rmaRequestRepo';
import {
  getTroubleshootingData,
  upsertTroubleshootingData,
} from '../repositories/rmaTroubleshootingRepo';
import { updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';
import {
  getPlaybookForSkuGroup,
  getNextStep,
  isPlaybookComplete,
} from './playbookService';

export async function getRmaWithTroubleshooting(rmaId: string) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  const troubleshooting = await getTroubleshootingData(rmaId);
  const playbook = await getPlaybookForSkuGroup(rma.skuGroupName);

  const completedSteps = troubleshooting?.stepsCompletedJson || [];
  const currentStepId =
    completedSteps.length > 0
      ? completedSteps[completedSteps.length - 1]?.stepId
      : null;

  const nextStep = playbook
    ? getNextStep(playbook, currentStepId, completedSteps)
    : null;

  return {
    rma,
    troubleshooting,
    playbook,
    nextStep,
    isComplete: playbook ? isPlaybookComplete(playbook, completedSteps) : false,
  };
}

export async function saveSymptoms(rmaId: string, symptoms: any) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  await upsertTroubleshootingData(rmaId, { symptomsJson: symptoms });

  await createAuditLogEntry({
    rmaId,
    eventType: 'PLAYBOOK_STEP_COMPLETED',
    actorType: 'CUSTOMER',
    payloadJson: { action: 'symptoms_saved', symptoms },
  });
}

export async function completeStep(
  rmaId: string,
  stepId: string,
  answer: any,
  evidenceIds?: string[],
) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  const troubleshooting = await getTroubleshootingData(rmaId);
  const playbook = await getPlaybookForSkuGroup(rma.skuGroupName);

  if (!playbook) {
    throw Object.assign(new Error('Playbook not found'), { status: 404 });
  }

  // Validate step exists in playbook
  const step = playbook.steps.find((s) => s.id === stepId);
  if (!step) {
    throw Object.assign(new Error('Invalid step ID'), { status: 400 });
  }

  const completedSteps = troubleshooting?.stepsCompletedJson || [];
  const stepData = {
    stepId,
    answer,
    evidenceIds: evidenceIds || [],
    completedAt: new Date().toISOString(),
  };

  completedSteps.push(stepData);

  await upsertTroubleshootingData(rmaId, {
    stepsCompletedJson: completedSteps,
  });

  // Update status
  if (rma.status === 'STARTED') {
    await updateRmaRequestStatus(rmaId, 'TROUBLESHOOTING_IN_PROGRESS');
  }

  await createAuditLogEntry({
    rmaId,
    eventType: 'PLAYBOOK_STEP_COMPLETED',
    actorType: 'CUSTOMER',
    payloadJson: { stepId, answer, evidenceIds },
  });

  // Check if complete
  const isComplete = isPlaybookComplete(playbook, completedSteps);
  if (isComplete) {
    await updateRmaRequestStatus(rmaId, 'TROUBLESHOOTING_COMPLETE');
  }

  const nextStep = getNextStep(playbook, stepId, completedSteps, {
    [stepId]: answer,
  });

  return {
    nextStep,
    isComplete,
  };
}

export async function optOutOfTroubleshooting(rmaId: string) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  await upsertTroubleshootingData(rmaId, {
    customerOptedOutOfTS: true,
  });

  await updateRmaRequestStatus(rmaId, 'TROUBLESHOOTING_COMPLETE');

  await createAuditLogEntry({
    rmaId,
    eventType: 'CUSTOMER_OPTED_OUT',
    actorType: 'CUSTOMER',
    payloadJson: {},
  });
}
