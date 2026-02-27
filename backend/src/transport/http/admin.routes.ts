import { Router, Request, Response, NextFunction } from 'express';
import { getRmaQueue, getRmaDetail, overrideRmaStatus, submitFeedback } from '../../services/adminService';
import { upsertPlaybook, getActivePlaybook } from '../../repositories/rmaPlaybookRepo';

const router = Router();

// TODO: Add admin authentication middleware (IP allowlist + credentials)

// GET /api/admin/rma/queue
router.get('/rma/queue', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : undefined;
    const isInternational = req.query.isInternational === 'true' ? true : req.query.isInternational === 'false' ? false : undefined;
    const outOfWarranty = req.query.outOfWarranty === 'true' ? true : req.query.outOfWarranty === 'false' ? false : undefined;

    const items = await getRmaQueue({
      status: status as any,
      days,
      isInternational,
      outOfWarranty,
    });

    return res.json({ items });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/rma/{rmaId}
router.get('/rma/:rmaId', async (req, res, next) => {
  try {
    const { rmaId } = req.params;
    const detail = await getRmaDetail(rmaId);
    return res.json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/rma/{rmaId}/override
router.post('/rma/:rmaId/override', async (req, res, next) => {
  try {
    const { rmaId } = req.params;
    const { status, reason, adminUser } = req.body;

    if (!status || !reason) {
      return res.status(400).json({ error: 'Missing status or reason' });
    }

    await overrideRmaStatus(rmaId, status, reason, adminUser || 'admin');
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/rma/{rmaId}/feedback
router.post('/rma/:rmaId/feedback', async (req, res, next) => {
  try {
    const { rmaId } = req.params;
    const { decisionCorrect, notes, adminUser } = req.body;

    if (typeof decisionCorrect !== 'boolean') {
      return res.status(400).json({ error: 'Missing decisionCorrect' });
    }

    await submitFeedback(rmaId, decisionCorrect, notes || '', adminUser || 'admin');
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/rma/{rmaId}/audit
router.get('/rma/:rmaId/audit', async (req, res, next) => {
  try {
    const { rmaId } = req.params;
    const detail = await getRmaDetail(rmaId);
    return res.json({ events: detail.auditLog });
  } catch (err) {
    next(err);
  }
});

// Admin playbook endpoints
router.post('/playbook/upsert', async (req, res, next) => {
  try {
    const { skuGroupName, playbookJson, isActive } = req.body;

    if (!skuGroupName || !playbookJson) {
      return res.status(400).json({ error: 'Missing skuGroupName or playbookJson' });
    }

    await upsertPlaybook(skuGroupName, playbookJson, isActive !== false);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/playbook/:skuGroupName', async (req, res, next) => {
  try {
    const { skuGroupName } = req.params;
    const playbook = await getActivePlaybook(skuGroupName);

    if (!playbook) {
      return res.status(404).json({ error: 'Playbook not found' });
    }

    return res.json({
      skuGroupName: playbook.skuGroupName,
      playbookJson: playbook.playbookJson,
      version: playbook.version,
      isActive: playbook.isActive,
      updatedAt: playbook.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

export { router as adminRouter };

