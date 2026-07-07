import apiClient from '../../lib/api-client';
import { showAppAlert } from '../common/alerts/appAlert';

/**
 * Fetch a course certificate and present it in the branded alert. Shared by
 * the training list and the course player's completion step.
 */
export async function showCertificateAlert(courseId: string): Promise<void> {
  try {
    const res = await apiClient.get<{
      success: boolean;
      data: { courseTitle: string; completedAt: string; expiresAt: string | null; verificationCode: string };
    }>(`/api/learning/certificate/${courseId}`);
    const c = res.data.data;
    const completed = new Date(c.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const expires = c.expiresAt
      ? new Date(c.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No expiry';
    showAppAlert(
      c.courseTitle,
      `Completed ${completed}\nExpires: ${expires}\nVerification code: ${c.verificationCode}`,
      undefined,
      { variant: 'success', icon: 'ribbon' },
    );
  } catch {
    showAppAlert('No certificate yet', 'Finish the course to unlock your certificate here.', undefined, { variant: 'info' });
  }
}
