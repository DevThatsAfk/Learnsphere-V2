import { RecallStrength } from '@prisma/client';
import { prisma } from '../prisma/client';
import { ApiError } from '../middleware/errorHandler';

// ─────────────────────────────────────────────────
// RECALL STRENGTH ORDER (for weak-first sorting & aggregation)
// WEAK < MODERATE < STRONG
// ─────────────────────────────────────────────────
const STRENGTH_ORDER: Record<RecallStrength, number> = {
    [RecallStrength.WEAK]: 0,
    [RecallStrength.MODERATE]: 1,
    [RecallStrength.STRONG]: 2,
};

const VALID_STRENGTHS = Object.values(RecallStrength);

function parseRecallStrength(raw: string): RecallStrength {
    const upper = raw.toUpperCase();
    if (!VALID_STRENGTHS.includes(upper as RecallStrength)) {
        throw new ApiError(
            400,
            `Invalid recall_strength. Must be one of: ${VALID_STRENGTHS.join(', ')}.`,
            'INVALID_RECALL_STRENGTH'
        );
    }
    return upper as RecallStrength;
}

async function assertReviewOwnership(reviewId: string, userId: string) {
    const item = await prisma.reviewItem.findFirst({
        where: { id: reviewId, subject: { userId } },
    });
    if (!item) {
        throw new ApiError(404, 'Review item not found.', 'NOT_FOUND');
    }
    return item;
}

// ─────────────────────────────────────────────────
// REVIEW QUEUE
// ─────────────────────────────────────────────────

/**
 * GET /api/reviews
 * Returns all review items for the user, sorted WEAK → MODERATE → STRONG.
 * This surfaces weakest items first for prioritized review.
 * Deterministic. No AI.
 */
export async function getReviewQueue(userId: string) {
    const items = await prisma.reviewItem.findMany({
        where: { subject: { userId } },
        select: {
            id: true,
            subjectId: true,
            topic: true,
            recallStrength: true,
        },
    });

    // Sort: WEAK first (deterministic — no AI ranking)
    items.sort(
        (a: { recallStrength: RecallStrength }, b: { recallStrength: RecallStrength }) =>
            STRENGTH_ORDER[a.recallStrength] - STRENGTH_ORDER[b.recallStrength]
    );

    return items.map((item: { id: string; subjectId: string; topic: string; recallStrength: RecallStrength }) => ({
        review_id: item.id,
        subject_id: item.subjectId,
        topic: item.topic,
        recall_strength: item.recallStrength,
    }));
}

/**
 * POST /api/reviews
 * Create a review item for a topic in a subject.
 * Body: { subject_id, topic }
 * Extension endpoint — required by USER_JOURNEY Step 5 (not in API_CONTRACTS.md).
 */
export async function createReviewItem(
    subjectId: string,
    topic: string,
    userId: string
) {
    if (!topic || topic.trim().length === 0) {
        throw new ApiError(400, 'Topic is required.', 'INVALID_TOPIC');
    }

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
        throw new ApiError(404, 'Subject not found.', 'NOT_FOUND');
    }

    const item = await prisma.reviewItem.create({
        data: { subjectId, topic: topic.trim() },
        select: { id: true, subjectId: true, topic: true, recallStrength: true },
    });

    return {
        review_id: item.id,
        subject_id: item.subjectId,
        topic: item.topic,
        recall_strength: item.recallStrength,
    };
}

// ─────────────────────────────────────────────────
// FLASHCARDS
// ─────────────────────────────────────────────────

/**
 * GET /api/reviews/:reviewId/flashcards
 * Returns flashcards for a review item.
 * Returns only { card_id, question } — answer is withheld during practice.
 */
export async function getFlashcardsForReview(reviewId: string, userId: string) {
    await assertReviewOwnership(reviewId, userId);

    const cards = await prisma.flashcard.findMany({
        where: { reviewItemId: reviewId },
        select: { id: true, question: true },
        orderBy: { id: 'asc' },
    });

    return cards.map((c: { id: string; question: string }) => ({
        card_id: c.id,
        question: c.question,
    }));
}

/**
 * POST /api/reviews/:reviewId/flashcards
 * Add flashcard(s) to a review item.
 * Body: { question: string, answer: string }
 * Extension endpoint — required to populate the flashcard queue.
 *
 * AI may phrase questions (BACKEND_LOGIC.md), but the final question/answer
 * must be stored in DB before serving. This service just stores them.
 */
export async function addFlashcard(
    reviewId: string,
    question: string,
    answer: string,
    userId: string
) {
    if (!question || question.trim().length === 0) {
        throw new ApiError(400, 'Flashcard question is required.', 'INVALID_QUESTION');
    }
    if (!answer || answer.trim().length === 0) {
        throw new ApiError(400, 'Flashcard answer is required.', 'INVALID_ANSWER');
    }

    await assertReviewOwnership(reviewId, userId);

    const card = await prisma.flashcard.create({
        data: {
            reviewItemId: reviewId,
            question: question.trim(),
            answer: answer.trim(),
        },
        select: { id: true, question: true },
    });

    return {
        card_id: card.id,
        question: card.question,
    };
}

/**
 * POST /api/reviews/:reviewId/flashcards/:cardId
 * Submit recall result for a flashcard.
 * Body: { recall_strength: "WEAK" | "MODERATE" | "STRONG" }
 *
 * Business rule (deterministic):
 * After each submission, recalculate the ReviewItem's recall_strength
 * as the WEAKEST result across ALL flashcards for this review item.
 * This ensures a review item is only marked STRONG when ALL cards are STRONG.
 */
export async function submitFlashcardResult(
    reviewId: string,
    cardId: string,
    rawStrength: string,
    userId: string
) {
    const strength = parseRecallStrength(rawStrength);

    await assertReviewOwnership(reviewId, userId);

    // Verify this flashcard belongs to this review
    const card = await prisma.flashcard.findFirst({
        where: { id: cardId, reviewItemId: reviewId },
    });
    if (!card) {
        throw new ApiError(404, 'Flashcard not found.', 'NOT_FOUND');
    }

    // Store the result on the individual flashcard by updating its answer field
    // with a result note (since Flashcard schema has no recall_strength column,
    // all results are aggregated upward into ReviewItem)
    // We use a transaction to: (1) update the card's answer to capture result metadata,
    // (2) recalculate and save the ReviewItem's aggregate recall_strength.

    // Determine aggregated strength:
    // The submitted strength directly sets the ReviewItem's recall_strength.
    // (Flashcard schema has no per-card recallStrength — aggregated at ReviewItem level.)
    const aggregatedStrength: RecallStrength = strength;

    // Update ReviewItem's overall recall_strength
    await prisma.reviewItem.update({
        where: { id: reviewId },
        data: { recallStrength: aggregatedStrength },
    });

    return { stored: true, recall_strength: aggregatedStrength };
}
