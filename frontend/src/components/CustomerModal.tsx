import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rmaApi, RmaStatus } from '../api/rmaApi';
import './CustomerModal.css';

type Step = 'confirm' | 'troubleshooting' | 'terms' | 'shipping' | 'confirmation';

export default function CustomerModal() {
  const [currentStep, setCurrentStep] = useState<Step>('confirm');
  const [rmaId, setRmaId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadedEvidence, setUploadedEvidence] = useState<string[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [selfShipTracking, setSelfShipTracking] = useState({ carrier: '', tracking: '' });

  const queryClient = useQueryClient();

  // Get RMA ID from URL or session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenRmaId = params.get('rmaId');
    if (tokenRmaId) {
      setRmaId(tokenRmaId);
    }
  }, []);

  const { data: rmaStatus, isLoading } = useQuery<RmaStatus>({
    queryKey: ['rma', rmaId],
    queryFn: () => rmaApi.getStatus(rmaId!),
    enabled: !!rmaId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => rmaApi.uploadEvidence(rmaId!, file),
    onSuccess: (data) => {
      setUploadedEvidence([...uploadedEvidence, data.evidenceId]);
    },
  });

  const stepMutation = useMutation({
    mutationFn: ({ stepId, answer }: { stepId: string; answer: any }) =>
      rmaApi.completeStep(rmaId!, stepId, answer, uploadedEvidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rma', rmaId] });
      if (rmaStatus?.isComplete) {
        setCurrentStep('terms');
      }
    },
  });

  const termsMutation = useMutation({
    mutationFn: () => rmaApi.acceptTerms(rmaId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rma', rmaId] });
      setCurrentStep('shipping');
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: () => rmaApi.authorize(rmaId!),
    onSuccess: (data) => {
      if (data.decision === 'AUTHORIZED') {
        queryClient.invalidateQueries({ queryKey: ['rma', rmaId] });
        setCurrentStep('shipping');
      }
    },
  });

  const labelOptionsQuery = useQuery({
    queryKey: ['labelOptions', rmaId],
    queryFn: () => rmaApi.getLabelOptions(rmaId!),
    enabled: currentStep === 'shipping' && !!rmaId,
  });

  const purchaseLabelMutation = useMutation({
    mutationFn: ({ carrier, service, rateId }: { carrier: string; service: string; rateId: string }) =>
      rmaApi.purchaseLabel(rmaId!, carrier, service, rateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rma', rmaId] });
      setCurrentStep('confirmation');
    },
  });

  const selfShipMutation = useMutation({
    mutationFn: () => rmaApi.recordSelfShip(rmaId!, selfShipTracking.carrier, selfShipTracking.tracking),
    onSuccess: () => {
      setCurrentStep('confirmation');
    },
  });

  const handleFileUpload = async (file: File) => {
    uploadMutation.mutate(file);
  };

  const handleStepComplete = () => {
    if (!rmaStatus?.nextStep) return;
    stepMutation.mutate({
      stepId: rmaStatus.nextStep.id,
      answer: selectedAnswer,
    });
    setSelectedAnswer('');
    setEvidenceFiles([]);
  };

  const handleAcceptTerms = () => {
    termsMutation.mutate();
  };

  const handleAuthorize = () => {
    authorizeMutation.mutate();
  };

  const handlePurchaseLabel = () => {
    const option = labelOptionsQuery.data?.find((opt: any) => opt.carrier === selectedCarrier);
    if (option) {
      purchaseLabelMutation.mutate({
        carrier: option.carrier,
        service: option.service,
        rateId: option.id,
      });
    }
  };

  const handleSelfShip = () => {
    selfShipMutation.mutate();
  };

  if (isLoading || !rmaStatus) {
    return (
      <div className="modal-container">
        <div className="modal-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  const { rma, nextStep, playbook } = rmaStatus;

  return (
    <div className="modal-container">
      <div className="modal-content">
        <h1>RMA Request</h1>
        <div className="step-indicator">
          <span className={currentStep === 'confirm' ? 'active' : ''}>1. Confirm</span>
          <span className={currentStep === 'troubleshooting' ? 'active' : ''}>2. Troubleshoot</span>
          <span className={currentStep === 'terms' ? 'active' : ''}>3. Terms</span>
          <span className={currentStep === 'shipping' ? 'active' : ''}>4. Shipping</span>
          <span className={currentStep === 'confirmation' ? 'active' : ''}>5. Complete</span>
        </div>

        {currentStep === 'confirm' && (
          <div className="step-content">
            <h2>Confirm Your Item</h2>
            <p><strong>Order ID:</strong> {rma.orderId}</p>
            <p><strong>SKU:</strong> {rma.sku}</p>
            <p><strong>Warranty Status:</strong> {rma.warrantyEligible ? 'In Warranty' : 'Out of Warranty'}</p>
            <button onClick={() => setCurrentStep('troubleshooting')}>Continue</button>
          </div>
        )}

        {currentStep === 'troubleshooting' && nextStep && (
          <div className="step-content">
            <h2>{nextStep.title}</h2>
            {nextStep.description && <p>{nextStep.description}</p>}
            {nextStep.mediaUrl && <img src={nextStep.mediaUrl} alt="Step media" />}
            
            <div className="answer-section">
              <label>
                <input
                  type="radio"
                  value="pass"
                  checked={selectedAnswer === 'pass'}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                />
                Fixed / Working
              </label>
              <label>
                <input
                  type="radio"
                  value="fail"
                  checked={selectedAnswer === 'fail'}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                />
                Still having issues
              </label>
            </div>

            {nextStep.requiresEvidence && (
              <div className="evidence-section">
                <label>Upload Evidence (Photo/Video)</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                />
                {uploadedEvidence.length > 0 && (
                  <p>Uploaded: {uploadedEvidence.length} file(s)</p>
                )}
              </div>
            )}

            <div className="button-group">
              <button onClick={handleStepComplete} disabled={!selectedAnswer}>
                Continue
              </button>
              <button onClick={() => setCurrentStep('terms')} className="secondary">
                Skip Troubleshooting
              </button>
            </div>
          </div>
        )}

        {currentStep === 'troubleshooting' && !nextStep && (
          <div className="step-content">
            <p>Troubleshooting complete!</p>
            <button onClick={() => setCurrentStep('terms')}>Continue to Terms</button>
          </div>
        )}

        {currentStep === 'terms' && (
          <div className="step-content">
            <h2>Terms and Conditions</h2>
            <div className="terms-box">
              <p>
                If the part arrives and tests good / no fault found, I agree to pay return shipping and a{' '}
                <strong>${rma.benchTestFeeAmount} bench test fee</strong> may be applied.
              </p>
            </div>
            <label>
              <input
                type="checkbox"
                checked={rma.acceptedBenchFeeTerms}
                onChange={handleAcceptTerms}
                disabled={rma.acceptedBenchFeeTerms}
              />
              I accept the terms and conditions
            </label>
            {rma.acceptedBenchFeeTerms && (
              <button onClick={handleAuthorize}>Request Authorization</button>
            )}
          </div>
        )}

        {currentStep === 'shipping' && (
          <div className="step-content">
            <h2>Return Shipping</h2>
            {rma.isInternational ? (
              <div>
                <p>International customers must provide their own shipping label.</p>
                <div className="self-ship-form">
                  <input
                    type="text"
                    placeholder="Carrier"
                    value={selfShipTracking.carrier}
                    onChange={(e) => setSelfShipTracking({ ...selfShipTracking, carrier: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Tracking Number"
                    value={selfShipTracking.tracking}
                    onChange={(e) => setSelfShipTracking({ ...selfShipTracking, tracking: e.target.value })}
                  />
                  <button onClick={handleSelfShip}>Submit Tracking</button>
                </div>
              </div>
            ) : labelOptionsQuery.data && labelOptionsQuery.data.length > 0 ? (
              <div>
                <p>Select a shipping option:</p>
                {labelOptionsQuery.data.map((option: any) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name="carrier"
                      value={option.carrier}
                      checked={selectedCarrier === option.carrier}
                      onChange={(e) => setSelectedCarrier(e.target.value)}
                    />
                    {option.carrier} {option.service} - ${option.rate}
                  </label>
                ))}
                <button onClick={handlePurchaseLabel} disabled={!selectedCarrier}>
                  Purchase Label
                </button>
                <button onClick={() => setCurrentStep('confirmation')} className="secondary">
                  I will ship myself
                </button>
              </div>
            ) : (
              <div>
                <p>No prepaid labels available. Please ship using your own label.</p>
                <div className="self-ship-form">
                  <input
                    type="text"
                    placeholder="Carrier"
                    value={selfShipTracking.carrier}
                    onChange={(e) => setSelfShipTracking({ ...selfShipTracking, carrier: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Tracking Number"
                    value={selfShipTracking.tracking}
                    onChange={(e) => setSelfShipTracking({ ...selfShipTracking, tracking: e.target.value })}
                  />
                  <button onClick={handleSelfShip}>Submit Tracking</button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'confirmation' && (
          <div className="step-content">
            <h2>RMA Authorized</h2>
            <p>Your RMA has been authorized. Please download the RMA document and include it in your return package.</p>
            <div className="download-buttons">
              <button onClick={() => rmaApi.downloadPdf(rmaId!)}>Download RMA PDF</button>
              {rmaStatus.rma.status === 'LABEL_ISSUED' && (
                <button onClick={() => rmaApi.downloadLabel(rmaId!)}>Download Label</button>
              )}
            </div>
            <p><strong>RMA ID:</strong> {rma.rmaId}</p>
            <p>Please pack the item securely and include the RMA document in the box.</p>
          </div>
        )}
      </div>
    </div>
  );
}
