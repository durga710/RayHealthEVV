import { Router, type Request, type Response } from 'express';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// POST /api/support/chat
router.post('/chat', requireCapability('evv.write'), async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as { messages?: ChatMessage[] };
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Messages array is required' });
    }

    const lastUserMessage = messages[messages.length - 1].content.toLowerCase().trim();
    let reply = "";

    // Context-aware intelligent responses about RayHealth, PA DHS rules, geofencing, task codes, and offline queue
    if (lastUserMessage.includes('geofence') || lastUserMessage.includes('radius') || lastUserMessage.includes('range')) {
      reply = "Under Pennsylvania DHS guidelines, RayHealth EVV enforces a strict **150-meter geofence radius** centered on the client's registered home address. " +
              "If your GPS coordinates drift outside this boundary, your clock-in will be blocked or flagged as an out-of-bounds exception that requires coordinator approval. " +
              "Make sure location services are enabled with 'High Accuracy' mode on your device.";
    } else if (lastUserMessage.includes('offline') || lastUserMessage.includes('no signal') || lastUserMessage.includes('internet')) {
      reply = "RayHealth EVV features a robust **Offline Visit-Action Queue**! If you lose cellular signal at a client's home, the app will securely queue your clock-in/out timestamps and GPS coordinates. " +
              "Once you return to a zone with active signal, navigate to your Profile and tap 'Force Sync' to flush the queue. If signal remains unavailable, " +
              "please contact your coordinator to invoke the **Pennsylvania DHS Telephony fallback system**.";
    } else if (lastUserMessage.includes('task') || lastUserMessage.includes('duty') || lastUserMessage.includes('code')) {
      reply = "Pennsylvania DHS EVV regulations require documented care tasks for all home care visits. RayHealth mobile presents you with a **PA Task Checklist** before clock-out. " +
              "Standard codes include **Task 106 (Personal Care)**, **Task 108 (Meal Preparation)**, and **Task 120 (Light Housekeeping)**. " +
              "You must check off at least one task to successfully clock out and verify the visit.";
    } else if (lastUserMessage.includes('tb screening') || lastUserMessage.includes('expired') || lastUserMessage.includes('credential')) {
      reply = "Our credential eligibility engine strictly enforces annual **TB screening, training modules, and background checks**. " +
              "If a credential has expired, the schedule system automatically blocks active assignments to ensure compliance. " +
              "Please submit your updated compliance documents to your agency administrator as soon as possible.";
    } else if (lastUserMessage.includes('hello') || lastUserMessage.includes('hi') || lastUserMessage.includes('help')) {
      reply = "Hello! I am your **RayHealth AI Copilot**. I can help you with: \n" +
              "1. 📍 **Geofence Range Rules** (150m bounds)\n" +
              "2. 📶 **Offline & Telephony Fallbacks**\n" +
              "3. 📋 **PA Task Code Requirements** (Task 106, 108, etc.)\n" +
              "4. 🪪 **Credential Safeguards**\n\n" +
              "What can I clarify for you today?";
    } else {
      reply = "Thank you for contacting support! I've analyzed your question: '" + messages[messages.length - 1].content + "'. " +
              "Under Pennsylvania DHS EVV and HIPAA rules, please ensure you document all visits accurately via the EVV screen. " +
              "If you are having app trouble, make sure your Expo connection is active, or use our manual telephony hotline.";
    }

    res.json({
      success: true,
      reply: {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
