/**
 * cron/followUpCron.ts — 7-day intervention follow-up cron job.
 *
 * Runs daily at 02:00 server time.
 * Finds interventions sent 7+ days ago, recalculates risk, logs outcome delta.
 *
 * Protected by CRON_SECRET header when called via HTTP.
 */
import cron from 'node-cron';
import { process7DayFollowUps } from '../services/interventionService';

export function startFollowUpCron() {
    // Run every day at 02:00
    cron.schedule('0 2 * * *', async () => {
        console.log('[Cron] Running 7-day intervention follow-up processor...');
        try {
            const result = await process7DayFollowUps();
            console.log(`[Cron] Processed ${result.processed} interventions`);
            result.outcomes.forEach(o => console.log(`[Cron]   ${o}`));
        } catch (err) {
            console.error('[Cron] Follow-up processor error:', err instanceof Error ? err.message : err);
        }
    });

    console.log('[Cron] Follow-up cron job registered (daily at 02:00)');
}
