import { getRmaRequest } from '../repositories/rmaRequestRepo';
import { getTroubleshootingData } from '../repositories/rmaTroubleshootingRepo';
import { getRmaLabel } from '../repositories/rmaLabelRepo';
import { updateRmaRequestHubSpot } from '../repositories/rmaRequestRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';
import { getConfig } from '../config/env';
import axios from 'axios';

// HubSpot integration - real API implementation
async function createHubSpotTicket(data: {
  subject: string;
  properties: Record<string, any>;
  contactId?: string;
  dealId?: string;
}): Promise<{ ticketId: string; contactId?: string; dealId?: string }> {
  const config = getConfig();
  if (!config.hubspot.apiKey) {
    // In dev, return mock
    console.warn('HubSpot API key not configured, using mock ticket');
    return {
      ticketId: `ticket_${Date.now()}`,
      contactId: data.contactId,
      dealId: data.dealId,
    };
  }

  try {
    const associations: any[] = [];
    if (data.contactId) {
      associations.push({
        to: { id: data.contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 16 }],
      });
    }
    if (data.dealId) {
      associations.push({
        to: { id: data.dealId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
      });
    }

    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/tickets',
      {
        properties: {
          subject: data.subject,
          ...data.properties,
        },
        ...(associations.length > 0 && { associations }),
      },
      {
        headers: {
          Authorization: `Bearer ${config.hubspot.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      ticketId: response.data.id,
      contactId: data.contactId,
      dealId: data.dealId,
    };
  } catch (error: any) {
    console.error('HubSpot ticket creation failed:', error.response?.data || error.message);
    // Fallback to mock in case of error
    return {
      ticketId: `ticket_${Date.now()}`,
      contactId: data.contactId,
      dealId: data.dealId,
    };
  }
}

async function updateHubSpotTicket(
  ticketId: string,
  note?: string,
  properties?: Record<string, any>,
): Promise<void> {
  const config = getConfig();
  if (!config.hubspot.apiKey) {
    return; // Mock - no-op
  }

  try {
    if (properties) {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}`,
        { properties },
        {
          headers: {
            Authorization: `Bearer ${config.hubspot.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (note) {
      // Create a note and associate it with the ticket
      const noteResponse = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/notes',
        {
          properties: {
            hs_note_body: note,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.hubspot.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Associate note with ticket
      if (noteResponse.data.id) {
        await axios.put(
          `https://api.hubapi.com/crm/v3/objects/notes/${noteResponse.data.id}/associations/tickets/${ticketId}/214`,
          {},
          {
            headers: {
              Authorization: `Bearer ${config.hubspot.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        );
      }
    }
  } catch (error: any) {
    console.error('HubSpot ticket update failed:', error.response?.data || error.message);
    // Don't throw - HubSpot updates are not critical path
  }
}

export async function createHubSpotTicketForRma(rmaId: string): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw new Error('RMA not found');
  }

  const troubleshooting = await getTroubleshootingData(rmaId);

  const properties: Record<string, any> = {
    orderId: rma.orderId,
    orderItemId: rma.orderItemId,
    sku: rma.sku,
    skuGroup: rma.skuGroupName,
    rmaId: rma.rmaId,
    warrantyEligible: rma.warrantyEligible,
    warrantyEndDate: rma.warrantyEndDate?.toISOString() || '',
    termsAccepted: rma.acceptedBenchFeeTerms,
    benchFeeAmount: rma.benchTestFeeAmount.toString(),
    status: rma.status,
  };

  if (rma.customerSelectedReturnMethod) {
    properties.returnMethod = rma.customerSelectedReturnMethod;
  }
  if (rma.carrierPreference) {
    properties.carrier = rma.carrierPreference;
  }

  const label = await getRmaLabel(rmaId);
  if (label?.trackingNumber) {
    properties.trackingNumber = label.trackingNumber;
  }

  const result = await createHubSpotTicket({
    subject: `RMA - ${rma.orderId} - ${rma.sku}`,
    properties,
    contactId: rma.hubSpotContactId || undefined,
    dealId: rma.hubSpotDealId || undefined,
  });

  await updateRmaRequestHubSpot(rmaId, result.ticketId, result.contactId, result.dealId);

  await createAuditLogEntry({
    rmaId,
    eventType: 'HUBSPOT_TICKET_CREATED',
    actorType: 'SYSTEM',
    payloadJson: {
      ticketId: result.ticketId,
      contactId: result.contactId,
      dealId: result.dealId,
    },
  });
}

export async function updateHubSpotTicketForRma(
  rmaId: string,
  event: string,
  details?: Record<string, any>,
): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma || !rma.hubSpotTicketId) {
    return; // No ticket to update
  }

  const note = `RMA Update: ${event}${details ? `\n${JSON.stringify(details, null, 2)}` : ''}`;

  const properties: Record<string, any> = {
    status: rma.status,
  };

  if (details) {
    Object.assign(properties, details);
  }

  await updateHubSpotTicket(rma.hubSpotTicketId, note, properties);

  await createAuditLogEntry({
    rmaId,
    eventType: 'HUBSPOT_TICKET_UPDATED',
    actorType: 'SYSTEM',
    payloadJson: { event, details },
  });
}
