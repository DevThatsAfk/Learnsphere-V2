import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
    getReviewQueue,
    createReviewItem,
    getFlashcardsForReview,
    addFlashcard,
    submitFlashcardResult,
} from '../services/reviewService';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/reviews
 * Returns the full review queue for the user, sorted WEAK → MODERATE → STRONG.
 * Response: ReviewItem[] — { review_id, subject_id, topic, recall_strength }
 */
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const queue = await getReviewQueue(userId);
        res.json(queue);
    })
);

/**
 * POST /api/reviews
 * Create a new review item for a topic.
 * Body: { subject_id: string, topic: string }
 * Response: 201 + ReviewItem
 * NOTE: Extension endpoint — required by USER_JOURNEY Step 5.
 */
router.post(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const { subject_id, topic } = req.body as { subject_id: string; topic: string };
        if (!subject_id) throw new ApiError(400, 'subject_id is required.', 'MISSING_SUBJECT_ID');
        if (!topic) throw new ApiError(400, 'topic is required.', 'MISSING_TOPIC');
        const item = await createReviewItem(subject_id, topic, userId);
        res.status(201).json(item);
    })
);

/**
 * GET /api/reviews/:reviewId/flashcards
 * Returns flashcards for a review item.
 * Answer is withheld during practice (returns { card_id, question } only).
 * Response: Flashcard[] — { card_id, question }
 */
router.get(
    '/:reviewId/flashcards',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const reviewId = req.params['reviewId'] as string;
        const cards = await getFlashcardsForReview(reviewId, userId);
        res.json(cards);
    })
);

/**
 * POST /api/reviews/:reviewId/flashcards
 * Add a flashcard to a review item.
 * Body: { question: string, answer: string }
 * Response: 201 + Flashcard — { card_id, question }
 * NOTE: Extension endpoint — required to populate the review queue with questions.
 */
router.post(
    '/:reviewId/flashcards',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const reviewId = req.params['reviewId'] as string;
        const { question, answer } = req.body as { question: string; answer: string };
        const card = await addFlashcard(reviewId, question, answer, userId);
        res.status(201).json(card);
    })
);

/**
 * POST /api/reviews/:reviewId/flashcards/:cardId
 * Submit recall result for a flashcard.
 * Body: { recall_strength: "WEAK" | "MODERATE" | "STRONG" }
 * Response: 200 — { stored: true, recall_strength }
 *
 * Also updates the parent ReviewItem's recall_strength (deterministic aggregation).
 */
router.post(
    '/:reviewId/flashcards/:cardId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const reviewId = req.params['reviewId'] as string;
        const cardId = req.params['cardId'] as string;
        const { recall_strength } = req.body as { recall_strength: string };
        if (!recall_strength) {
            throw new ApiError(400, 'recall_strength is required.', 'MISSING_RECALL_STRENGTH');
        }
        const result = await submitFlashcardResult(reviewId, cardId, recall_strength, userId);
        res.json(result);
    })
);

export default router;
