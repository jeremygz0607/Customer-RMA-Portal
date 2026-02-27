import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import './AdminDashboard.css';

const API_BASE = '/api/admin';

interface RmaQueueItem {
  rmaId: string;
  brand: string;
  orderId: string;
  orderItemId: string;
  sku: string;
  status: string;
  warrantyEligible: boolean;
  isInternational: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const [selectedRmaId, setSelectedRmaId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    days: '7',
    isInternational: '',
    outOfWarranty: '',
  });
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: ['adminQueue', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.days) params.append('days', filters.days);
      if (filters.isInternational) params.append('isInternational', filters.isInternational);
      if (filters.outOfWarranty) params.append('outOfWarranty', filters.outOfWarranty);
      const response = await axios.get(`${API_BASE}/rma/queue?${params}`);
      return response.data.items as RmaQueueItem[];
    },
  });

  const detailQuery = useQuery({
    queryKey: ['adminDetail', selectedRmaId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/rma/${selectedRmaId}`);
      return response.data;
    },
    enabled: !!selectedRmaId,
  });

  const auditQuery = useQuery({
    queryKey: ['adminAudit', selectedRmaId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/rma/${selectedRmaId}/audit`);
      return response.data.events;
    },
    enabled: !!selectedRmaId,
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_BASE}/rma/${selectedRmaId}/override`, {
        status: overrideStatus,
        reason: overrideReason,
        adminUser: 'admin', // TODO: Get from auth
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminDetail', selectedRmaId] });
      setOverrideStatus('');
      setOverrideReason('');
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_BASE}/rma/${selectedRmaId}/feedback`, {
        decisionCorrect: feedbackCorrect,
        notes: feedbackNotes,
        adminUser: 'admin', // TODO: Get from auth
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDetail', selectedRmaId] });
      setFeedbackCorrect(null);
      setFeedbackNotes('');
    },
  });

  return (
    <div className="admin-dashboard">
      <header>
        <h1>RMA Admin Dashboard</h1>
      </header>

      <div className="dashboard-content">
        <div className="queue-panel">
          <h2>Review Queue</h2>
          
          <div className="filters">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="AUTHORIZED">Authorized</option>
              <option value="DENIED">Denied</option>
            </select>

            <select
              value={filters.days}
              onChange={(e) => setFilters({ ...filters, days: e.target.value })}
            >
              <option value="1">Last 1 day</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>

            <label>
              <input
                type="checkbox"
                checked={filters.isInternational === 'true'}
                onChange={(e) =>
                  setFilters({ ...filters, isInternational: e.target.checked ? 'true' : '' })
                }
              />
              International only
            </label>

            <label>
              <input
                type="checkbox"
                checked={filters.outOfWarranty === 'true'}
                onChange={(e) =>
                  setFilters({ ...filters, outOfWarranty: e.target.checked ? 'true' : '' })
                }
              />
              Out of warranty
            </label>
          </div>

          <div className="queue-list">
            {queueQuery.isLoading && <div>Loading...</div>}
            {queueQuery.data?.map((item) => (
              <div
                key={item.rmaId}
                className={`queue-item ${selectedRmaId === item.rmaId ? 'selected' : ''}`}
                onClick={() => setSelectedRmaId(item.rmaId)}
              >
                <div className="queue-item-header">
                  <strong>{item.rmaId}</strong>
                  <span className={`status-badge status-${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                </div>
                <div className="queue-item-details">
                  <div>Order: {item.orderId}</div>
                  <div>SKU: {item.sku}</div>
                  <div>Created: {new Date(item.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-panel">
          {selectedRmaId ? (
            <>
              <h2>RMA Details</h2>
              {detailQuery.isLoading && <div>Loading...</div>}
              {detailQuery.data && (
                <div className="detail-content">
                  <div className="detail-section">
                    <h3>RMA Information</h3>
                    <p><strong>RMA ID:</strong> {detailQuery.data.rma.rmaId}</p>
                    <p><strong>Status:</strong> {detailQuery.data.rma.status}</p>
                    <p><strong>Brand:</strong> {detailQuery.data.rma.brand}</p>
                    <p><strong>Order ID:</strong> {detailQuery.data.rma.orderId}</p>
                    <p><strong>SKU:</strong> {detailQuery.data.rma.sku}</p>
                    <p><strong>Warranty:</strong> {detailQuery.data.rma.warrantyEligible ? 'Eligible' : 'Not Eligible'}</p>
                  </div>

                  {detailQuery.data.troubleshooting && (
                    <div className="detail-section">
                      <h3>Troubleshooting</h3>
                      <p>
                        <strong>Opted Out:</strong>{' '}
                        {detailQuery.data.troubleshooting.customerOptedOutOfTS ? 'Yes' : 'No'}
                      </p>
                      {detailQuery.data.troubleshooting.stepsCompletedJson && (
                        <p>
                          <strong>Steps Completed:</strong>{' '}
                          {detailQuery.data.troubleshooting.stepsCompletedJson.length}
                        </p>
                      )}
                    </div>
                  )}

                  {detailQuery.data.label && (
                    <div className="detail-section">
                      <h3>Shipping</h3>
                      {detailQuery.data.label.trackingNumber && (
                        <p><strong>Tracking:</strong> {detailQuery.data.label.trackingNumber}</p>
                      )}
                      {detailQuery.data.label.carrier && (
                        <p><strong>Carrier:</strong> {detailQuery.data.label.carrier}</p>
                      )}
                    </div>
                  )}

                  <div className="detail-section">
                    <h3>Override Status</h3>
                    <select
                      value={overrideStatus}
                      onChange={(e) => setOverrideStatus(e.target.value)}
                    >
                      <option value="">Select status...</option>
                      <option value="AUTHORIZED">Authorized</option>
                      <option value="DENIED">Denied</option>
                      <option value="NEEDS_REVIEW">Needs Review</option>
                    </select>
                    <textarea
                      placeholder="Reason for override"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={3}
                    />
                    <button
                      onClick={() => overrideMutation.mutate()}
                      disabled={!overrideStatus || !overrideReason}
                    >
                      Override
                    </button>
                  </div>

                  <div className="detail-section">
                    <h3>Feedback</h3>
                    <label>
                      <input
                        type="radio"
                        checked={feedbackCorrect === true}
                        onChange={() => setFeedbackCorrect(true)}
                      />
                      Decision was correct
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={feedbackCorrect === false}
                        onChange={() => setFeedbackCorrect(false)}
                      />
                      Decision was incorrect
                    </label>
                    <textarea
                      placeholder="Notes"
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      rows={3}
                    />
                    <button
                      onClick={() => feedbackMutation.mutate()}
                      disabled={feedbackCorrect === null}
                    >
                      Submit Feedback
                    </button>
                  </div>

                  <div className="detail-section">
                    <h3>Audit Log</h3>
                    <div className="audit-timeline">
                      {auditQuery.data?.map((event: any) => (
                        <div key={event.auditId} className="audit-event">
                          <div className="audit-event-time">
                            {new Date(event.createdAt).toLocaleString()}
                          </div>
                          <div className="audit-event-type">{event.eventType}</div>
                          <div className="audit-event-actor">by {event.actorType}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">Select an RMA from the queue to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
