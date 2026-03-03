import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
    generateFlashcardsFromFile,
    generateQuizFromFile,
} from '../services/geminiService';

const router = Router();
router.use(authenticateToken);

/**
 * POST /api/upload/generate
 * multipart/form-data fields:
 *   - file       — PDF, image, or text file (required)
 *   - type       — "flashcards" | "quiz" | "both" (default: "both")
 *   - flashcardCount — number (default: 5)
 *   - quizCount  — number (default: 3)
 *
 * Returns: { flashcards?, quiz?, fileInfo: { name, size, type } }
 */
router.post(
    '/generate',
    upload.single('file'),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        if (!req.file) {
            throw new ApiError(400, 'No file uploaded. Send a PDF, image, or text file.', 'NO_FILE');
        }

        const { type = 'both', flashcardCount = '5', quizCount = '3' } = req.body as {
            type?: string;
            flashcardCount?: string;
            quizCount?: string;
        };

        const { buffer, mimetype, originalname, size } = req.file;

        const response: {
            flashcards?: object[];
            quiz?: object[];
            fileInfo: { name: string; size: number; type: string };
        } = {
            fileInfo: { name: originalname, size, type: mimetype },
        };

        if (type === 'flashcards' || type === 'both') {
            response.flashcards = await generateFlashcardsFromFile(
                buffer,
                mimetype,
                parseInt(flashcardCount, 10)
            );
        }

        if (type === 'quiz' || type === 'both') {
            response.quiz = await generateQuizFromFile(
                buffer,
                mimetype,
                parseInt(quizCount, 10)
            );
        }

        res.json(response);
    })
);

export default router;
