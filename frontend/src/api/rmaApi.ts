import apiClient from './client';

export interface StartRmaRequest {
  brand: string;
  orderId: string;
  orderItemId: string;
  sku: string;
  customer: {
    id?: string;
    email?: string;
  };
}

export interface RmaStatus {
  rma: {
    rmaId: string;
    brand: string;
    orderId: string;
    orderItemId: string;
    sku: string;
    skuGroupName: string;
    warrantyEligible: boolean;
    status: string;
    benchTestFeeAmount: number;
    acceptedBenchFeeTerms: boolean;
  };
  troubleshooting: any;
  playbook: any;
  nextStep: any;
  isComplete: boolean;
}

export const rmaApi = {
  start: async (data: StartRmaRequest) => {
    const response = await apiClient.post('/rma/start', data);
    return response.data;
  },

  getStatus: async (rmaId: string): Promise<RmaStatus> => {
    const response = await apiClient.get(`/rma/${rmaId}`);
    return response.data;
  },

  saveSymptoms: async (rmaId: string, symptoms: any) => {
    await apiClient.post(`/rma/${rmaId}/symptoms`, { symptoms });
  },

  completeStep: async (rmaId: string, stepId: string, answer: any, evidenceIds?: string[]) => {
    const response = await apiClient.post(`/rma/${rmaId}/step/${stepId}`, {
      answer,
      evidenceIds,
    });
    return response.data;
  },

  uploadEvidence: async (rmaId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/rma/${rmaId}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  acceptTerms: async (rmaId: string) => {
    await apiClient.post(`/rma/${rmaId}/accept-terms`);
  },

  authorize: async (rmaId: string) => {
    const response = await apiClient.post(`/rma/${rmaId}/authorize`);
    return response.data;
  },

  getLabelOptions: async (rmaId: string) => {
    const response = await apiClient.post(`/rma/${rmaId}/label/options`);
    return response.data.options;
  },

  purchaseLabel: async (rmaId: string, carrier: string, service: string, rateId: string) => {
    const response = await apiClient.post(`/rma/${rmaId}/label/purchase`, {
      carrier,
      service,
      rateId,
    });
    return response.data;
  },

  recordSelfShip: async (rmaId: string, carrier: string, trackingNumber: string) => {
    await apiClient.post(`/rma/${rmaId}/self-ship`, { carrier, trackingNumber });
  },

  downloadPdf: (rmaId: string) => {
    const token = new URLSearchParams(window.location.search).get('rmaSessionToken');
    window.open(`/api/rma/${rmaId}/pdf?token=${token}`, '_blank');
  },

  downloadLabel: (rmaId: string) => {
    const token = new URLSearchParams(window.location.search).get('rmaSessionToken');
    window.open(`/api/rma/${rmaId}/label?token=${token}`, '_blank');
  },

  closeFixed: async (rmaId: string) => {
    await apiClient.post(`/rma/${rmaId}/close-fixed`);
  },
};
