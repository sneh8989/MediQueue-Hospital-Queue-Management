import { Router } from 'express';
import * as publicQueueController from '../controllers/publicQueueController.js';

const router = Router();

// Deliberately unauthenticated - see the header comment in
// publicQueueController.js for the privacy reasoning. These endpoints
// return only the reduced, non-identifying projection of queue data.
router.get('/', publicQueueController.getPublicQueueBoard);
router.get('/:id', publicQueueController.getPublicQueueEntry);

export default router;
