import { Router } from 'express';
import multer from 'multer';
import { startRmaSession } from '../../services/rmaStartService';
import { getRmaWithTroubleshooting, saveSymptoms, completeStep, optOutOfTroubleshooting } from '../../services/troubleshootingService';
import { uploadEvidence, getEvidenceList } from '../../services/evidenceService';
import { acceptTerms } from '../../services/termsService';
import { authorizeRma } from '../../services/authorizationService';
import { getLabelOptions, purchaseLabel } from '../../services/labelService';
import { recordSelfShip } from '../../services/selfShipService';
import { generateRmaPdf, streamRmaPdf, streamLabelPdf, streamEvidenceFile } from '../../services/pdfService';
import { closeFixed } from '../../services/closeFixedService';
import { requireSessionAuth, AuthenticatedRequest } from './middleware/sessionAuth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/rma/start (no auth required - called by Bitrix server-side)
router.post('/start', async (req, res, next) => {
  try {
    const { brand, orderId, orderItemId, sku, customer } = req.body;

    if (!brand || !orderId || !orderItemId || !sku || !customer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await startRmaSession({
      brand,
      orderId,
      orderItemId,
      sku,
      customer,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// All other endpoints require session auth
router.use(requireSessionAuth);

// GET /api/rma/:rmaId
router.get('/:rmaId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const data = await getRmaWithTroubleshooting(rmaId);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/symptoms
router.post('/:rmaId/symptoms', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { symptoms } = req.body;
    await saveSymptoms(rmaId, symptoms);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/step/:stepId
router.post('/:rmaId/step/:stepId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId, stepId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { answer, evidenceIds } = req.body;
    const result = await completeStep(rmaId, stepId, answer, evidenceIds);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/evidence (multipart)
router.post('/:rmaId/evidence', upload.single('file'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const evidence = await uploadEvidence(
      rmaId,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype,
    );
    return res.json(evidence);
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/accept-terms
router.post('/:rmaId/accept-terms', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const clientIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await acceptTerms(rmaId, String(clientIP), userAgent);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/authorize
router.post('/:rmaId/authorize', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await authorizeRma(rmaId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/label/options
router.post('/:rmaId/label/options', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const options = await getLabelOptions(rmaId);
    return res.json({ options });
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/label/purchase
router.post('/:rmaId/label/purchase', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { carrier, service, rateId } = req.body;
    const result = await purchaseLabel(rmaId, carrier, service, rateId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/self-ship
router.post('/:rmaId/self-ship', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { carrier, trackingNumber } = req.body;
    await recordSelfShip(rmaId, carrier, trackingNumber);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/rma/:rmaId/pdf
router.get('/:rmaId/pdf', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await streamRmaPdf(rmaId, res);
  } catch (err) {
    next(err);
  }
});

// GET /api/rma/:rmaId/label
router.get('/:rmaId/label', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await streamLabelPdf(rmaId, res);
  } catch (err) {
    next(err);
  }
});

// POST /api/rma/:rmaId/close-fixed
router.post('/:rmaId/close-fixed', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { rmaId } = req.params;
    if (req.rmaId !== rmaId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await closeFixed(rmaId);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as rmaRouter };

