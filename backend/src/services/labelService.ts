import { getRmaRequest, updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { upsertRmaLabel } from '../repositories/rmaLabelRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';
import { getConfig } from '../config/env';
import { saveLabelFile, readFile } from './storageService';
import axios from 'axios';

// EasyPost integration - real API implementation
async function getEasyPostRates(
  returnAddress: any,
  customerAddress: any,
  parcel: any,
): Promise<any[]> {
  const config = getConfig();
  if (!config.easypost.apiKey) {
    console.warn('EasyPost API key not configured, using mock rates');
    return [
      {
        id: 'rate_ups_ground',
        carrier: 'UPS',
        service: 'Ground',
        rate: '12.50',
      },
      {
        id: 'rate_fedex_ground',
        carrier: 'FedEx',
        service: 'Ground',
        rate: '13.00',
      },
    ];
  }

  try {
    // Create addresses
    const toAddressResponse = await axios.post(
      'https://api.easypost.com/v2/addresses',
      {
        street1: customerAddress.street1,
        city: customerAddress.city,
        state: customerAddress.state,
        zip: customerAddress.zip,
        country: customerAddress.country || 'US',
      },
      {
        headers: {
          Authorization: `Bearer ${config.easypost.apiKey}`,
        },
      },
    );

    const fromAddressResponse = await axios.post(
      'https://api.easypost.com/v2/addresses',
      {
        street1: returnAddress.street1,
        city: returnAddress.city,
        state: returnAddress.state,
        zip: returnAddress.zip,
        country: returnAddress.country || 'US',
      },
      {
        headers: {
          Authorization: `Bearer ${config.easypost.apiKey}`,
        },
      },
    );

    // Create parcel
    const parcelResponse = await axios.post(
      'https://api.easypost.com/v2/parcels',
      {
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
        weight: parcel.weight,
      },
      {
        headers: {
          Authorization: `Bearer ${config.easypost.apiKey}`,
        },
      },
    );

    // Create shipment and get rates
    const shipmentResponse = await axios.post(
      'https://api.easypost.com/v2/shipments',
      {
        to_address: { id: toAddressResponse.data.id },
        from_address: { id: fromAddressResponse.data.id },
        parcel: { id: parcelResponse.data.id },
      },
      {
        headers: {
          Authorization: `Bearer ${config.easypost.apiKey}`,
        },
      },
    );

    const rates = shipmentResponse.data.rates || [];
    return rates.map((rate: any) => ({
      id: rate.id,
      carrier: rate.carrier,
      service: rate.service,
      rate: rate.rate,
      billingMode: rate.billing_type || 'PREPAID',
      shipmentId: shipmentResponse.data.id,
    }));
  } catch (error: any) {
    console.error('EasyPost rates fetch failed:', error.response?.data || error.message);
    return [];
  }
}

async function purchaseEasyPostLabel(
  shipmentId: string,
  rateId: string,
): Promise<{ trackingNumber: string; labelUrl: string; labelBuffer: Buffer }> {
  const config = getConfig();
  if (!config.easypost.apiKey) {
    console.warn('EasyPost API key not configured, using mock label');
    return {
      trackingNumber: '1Z999AA10123456784',
      labelUrl: 'https://easypost.com/labels/mock.pdf',
      labelBuffer: Buffer.from('mock pdf content'),
    };
  }

  try {
    // Buy the label
    const buyResponse = await axios.post(
      `https://api.easypost.com/v2/shipments/${shipmentId}/buy`,
      { rate: { id: rateId } },
      {
        headers: {
          Authorization: `Bearer ${config.easypost.apiKey}`,
        },
      },
    );

    const trackingNumber = buyResponse.data.tracking_code;
    const labelUrl = buyResponse.data.postage_label?.label_url;

    // Download the label PDF
    let labelBuffer: Buffer;
    if (labelUrl) {
      const labelResponse = await axios.get(labelUrl, {
        responseType: 'arraybuffer',
      });
      labelBuffer = Buffer.from(labelResponse.data);
    } else {
      throw new Error('Label URL not available');
    }

    return {
      trackingNumber,
      labelUrl,
      labelBuffer,
    };
  } catch (error: any) {
    console.error('EasyPost label purchase failed:', error.response?.data || error.message);
    throw new Error('Failed to purchase label');
  }
}

export async function getLabelOptions(rmaId: string) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  if (rma.status !== 'AUTHORIZED') {
    throw Object.assign(
      new Error(`Cannot get label options in status: ${rma.status}`),
      { status: 400 },
    );
  }

  // Rule 7.6: International must use own label
  if (rma.isInternational) {
    return [];
  }

  // Rule 7.2: Out of warranty - label issuance disabled (self-ship only)
  if (!rma.warrantyEligible) {
    return [];
  }

  // Get return address from config based on brand
  const config = getConfig();
  const returnAddress = {
    name: rma.brand === 'UPFIX' ? 'UpFix Returns' : 'MyAirbags Returns',
    street1: config.returnAddressStreet1,
    city: config.returnAddressCity,
    state: config.returnAddressState,
    zip: config.returnAddressZip,
    country: 'US',
  };

  // TODO: Get customer address from DW or order data
  const customerAddress = {
    street1: '123 Customer St',
    city: 'Customer City',
    state: 'CA',
    zip: '90210',
    country: 'US',
  };

  const parcel = {
    length: 10,
    width: 8,
    height: 4,
    weight: 2,
  };

  const rates = await getEasyPostRates(returnAddress, customerAddress, parcel);

  // Filter based on USPS rule (7.7)
  const filteredRates = rates.filter((rate) => {
    if (rate.carrier === 'USPS') {
      // Only allow USPS Pay-on-Delivery if enabled
      return config.uspsPayOnDeliveryEnabled && rate.billingMode === 'USPS_PAY_ON_DELIVERY';
    }
    return true; // UPS/FedEx always allowed
  });

  await createAuditLogEntry({
    rmaId,
    eventType: 'LABEL_OPTIONS_SHOWN',
    actorType: 'SYSTEM',
    payloadJson: { optionsCount: filteredRates.length },
  });

  return filteredRates;
}

export async function purchaseLabel(
  rmaId: string,
  carrier: string,
  service: string,
  rateId: string,
) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  if (rma.status !== 'AUTHORIZED') {
    throw Object.assign(
      new Error(`Cannot purchase label in status: ${rma.status}`),
      { status: 400 },
    );
  }

  // Rule 7.6: International cannot purchase labels
  if (rma.isInternational) {
    throw Object.assign(new Error('International customers must use own label'), {
      status: 400,
    });
  }

  // Rule 7.2: Out of warranty cannot get labels
  if (!rma.warrantyEligible) {
    throw Object.assign(new Error('Label issuance disabled for out-of-warranty items'), {
      status: 400,
    });
  }

  // Get shipment ID from stored options or create new shipment
  // For now, we'll need to store shipment ID when getting options
  // This is a simplified version - in production, store shipment ID in RMA_Label or session
  const options = await getLabelOptions(rmaId);
  const selectedOption = options.find((opt: any) => opt.id === rateId);
  const shipmentId = selectedOption?.shipmentId || 'shipment_id';

  // Purchase label from EasyPost
  const labelData = await purchaseEasyPostLabel(shipmentId, rateId);

  // Save label PDF
  const labelFilePath = await saveLabelFile(
    rma.brand,
    rma.orderId,
    rma.rmaId,
    carrier,
    labelData.trackingNumber,
    labelData.labelBuffer,
  );

  // Store label data
  await upsertRmaLabel(rmaId, {
    easyPostShipmentId: shipmentId,
    easyPostRateId: rateId,
    carrier,
    service,
    trackingNumber: labelData.trackingNumber,
    billingMode: carrier === 'USPS' ? 'USPS_PAY_ON_DELIVERY' : 'PREPAID',
    labelFilePath,
    labelCreatedAt: new Date(),
  });

  await updateRmaRequestStatus(rmaId, 'LABEL_ISSUED');

  await createAuditLogEntry({
    rmaId,
    eventType: 'LABEL_PURCHASED',
    actorType: 'CUSTOMER',
    payloadJson: {
      carrier,
      service,
      trackingNumber: labelData.trackingNumber,
      rateId,
    },
  });

  return {
    trackingNumber: labelData.trackingNumber,
    carrier,
    service,
    labelUrl: `/api/rma/${rmaId}/label`,
  };
}
