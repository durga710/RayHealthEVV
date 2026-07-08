#!/usr/bin/env tsx
/**
 * Idempotent global learning-catalog seeder.
 *
 * Upserts a baseline set of Pennsylvania home-care training courses as GLOBAL
 * courses (agency_id = NULL) so every agency sees a ready-to-assign catalog
 * with real in-app content (objectives, lesson sections) and knowledge-check
 * quizzes. Upsert is keyed on (agency_id, code); existing courses are left as
 * they are so agency edits and prior seeds are never clobbered.
 *
 * Usage (against a Neon branch or local DB):
 *   DATABASE_URL="postgres://…?sslmode=require&branch=br-…" \
 *     npx tsx packages/core/scripts/seed-learning-catalog.ts
 *
 * Run AFTER migrations (`npm run db:migrate`).
 */
import { createDb } from '../src/db/knex.js';
import { LearningRepository } from '../src/repositories/learning-repository.js';
import type { NewLearningCourse } from '../src/domain/learning.js';

const CATALOG: NewLearningCourse[] = [
  {
    agencyId: null,
    code: 'ORIENT-PA',
    title: 'New Hire Orientation (PA §52.18)',
    description:
      'Required orientation covering agency policies, client rights, and your role before your first client visit.',
    cadence: 'one_time',
    expiresAfterDays: null,
    required: true,
    durationMinutes: 45,
    modules: {
      objectives: [
        'Understand your role and responsibilities as a direct care worker',
        'Describe client rights and how to protect dignity and privacy',
        'Know the agency chain of communication for questions and emergencies',
      ],
      sections: [
        {
          title: 'Your role in home care',
          content:
            'As a direct care worker you support clients with activities of daily living (ADLs) such as bathing, dressing, mobility, meal preparation, and light housekeeping. You are the agency’s eyes and ears in the home: report changes in a client’s condition, home safety hazards, or anything that concerns you. Always work within your assigned care plan. Never perform tasks outside your training or the plan.',
        },
        {
          title: 'Client rights & dignity',
          content:
            'Every client has the right to be treated with respect, to privacy, to participate in their own care decisions, and to be free from abuse, neglect, and exploitation. Knock before entering, explain what you are doing, and honor reasonable preferences. Protect health information. Never discuss a client’s situation with anyone outside the care team.',
        },
        {
          title: 'Communication & emergencies',
          content:
            'Clock in and out for every visit using the EVV app at the client’s home. If you cannot reach a client, suspect an emergency, or a visit cannot proceed safely, call your coordinator immediately. In a life-threatening emergency call 911 first, then notify the agency.',
        },
      ],
      note: 'Per PA Code §52.18, orientation must be completed before your first client contact.',
      quiz: [
        {
          question: 'Before performing a task for a client, you should:',
          options: [
            'Do whatever the client asks, even if it is not in the care plan',
            'Confirm the task is within your training and the assigned care plan',
            'Wait until your supervisor visits the home',
          ],
          correct: 1,
        },
        {
          question: 'A client tells you something private about their health. You may discuss it with:',
          options: [
            'Your family, since names are not used',
            'Anyone on social media if it is a good story',
            'Only the client’s care team, as needed to provide care',
          ],
          correct: 2,
        },
        {
          question: 'When should you clock in for a visit?',
          options: [
            'At the client’s home when the visit begins, using the EVV app',
            'From home before you leave',
            'At the end of the week for all visits at once',
          ],
          correct: 0,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'ANNUAL-HIPAA',
    title: 'Annual HIPAA Privacy & Security',
    description: 'Annual refresher on protecting client health information (PHI) and reporting privacy incidents.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 30,
    modules: {
      objectives: [
        'Define Protected Health Information (PHI) and give examples',
        'Apply the “minimum necessary” rule in daily work',
        'Recognize and report a potential privacy breach',
      ],
      sections: [
        {
          title: 'What is PHI?',
          content:
            'PHI is any health information that can identify a person: names, addresses, Medicaid IDs, diagnoses, visit notes, and even photos. You may only access and use PHI as needed to do your job. This is the “minimum necessary” rule: don’t look at records you don’t need, and don’t share more than required.',
        },
        {
          title: 'Protecting PHI in the field',
          content:
            'Keep your device locked with a passcode. Don’t leave paperwork visible in your car or home. Never text client details over personal apps. Use only the agency’s approved app for visit data. If you lose a device or paperwork, report it to the agency immediately.',
        },
        {
          title: 'Reporting incidents',
          content:
            'A breach is any unauthorized access, use, or disclosure of PHI: a lost phone, an email to the wrong person, or talking about a client in public. If you think a breach may have happened, report it to your privacy officer right away. Prompt reporting protects clients and limits harm; you will not be punished for reporting in good faith.',
        },
      ],
      quiz: [
        {
          question: 'Which of these is PHI?',
          options: ['A client’s Medicaid ID and diagnosis', 'The weather during your shift', 'Your own phone number'],
          correct: 0,
        },
        {
          question: 'The “minimum necessary” rule means you should:',
          options: [
            'Access only the client information you need to do your job',
            'Read every client’s full chart to be thorough',
            'Share client details with coworkers to stay informed',
          ],
          correct: 0,
        },
        {
          question: 'You accidentally send a visit note to the wrong person. You should:',
          options: ['Say nothing and hope nobody noticed', 'Report it to your privacy officer immediately', 'Delete your sent folder'],
          correct: 1,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'INFECTION-CTRL',
    title: 'Infection Control & Standard Precautions',
    description: 'Hand hygiene, PPE, and standard precautions to keep clients and caregivers safe.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 25,
    modules: {
      objectives: [
        'Perform hand hygiene at the right moments',
        'Select and use personal protective equipment (PPE) correctly',
        'Apply standard precautions in the home',
      ],
      sections: [
        {
          title: 'Hand hygiene',
          content:
            'Handwashing is the single most effective way to prevent the spread of infection. Wash with soap and water for at least 20 seconds before and after client contact, after using the restroom, before food prep, and after removing gloves. Use alcohol-based sanitizer when soap and water are not available and hands are not visibly soiled.',
        },
        {
          title: 'Standard precautions & PPE',
          content:
            'Treat all blood and body fluids as potentially infectious. Wear gloves when contact with body fluids is possible; wear a gown, mask, or eye protection when splashes are likely. Remove PPE carefully to avoid contaminating yourself, and dispose of it properly. Cover cuts, and never reuse single-use gloves.',
        },
      ],
      quiz: [
        {
          question: 'How long should you wash your hands with soap and water?',
          options: ['At least 20 seconds', 'About 3 seconds', 'Only if they look dirty'],
          correct: 0,
        },
        {
          question: 'Under standard precautions, blood and body fluids should be treated as:',
          options: ['Safe unless the client looks sick', 'Potentially infectious in all cases', 'A concern only in hospitals'],
          correct: 1,
        },
        {
          question: 'After removing your gloves, you should:',
          options: ['Reuse them for the next task', 'Perform hand hygiene', 'Skip washing if you used gloves'],
          correct: 1,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'ABUSE-NEGLECT',
    title: 'Recognizing & Reporting Abuse and Neglect',
    description: 'Identify signs of abuse, neglect, and exploitation, and follow mandated reporting duties.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 30,
    modules: {
      objectives: [
        'Recognize common signs of abuse, neglect, and financial exploitation',
        'Understand your duty to report',
        'Know how to report in Pennsylvania',
      ],
      sections: [
        {
          title: 'Types and signs',
          content:
            'Abuse can be physical, emotional, or sexual; neglect is the failure to provide for basic needs; exploitation is the misuse of a person’s money or property. Warning signs include unexplained bruises, fearfulness, poor hygiene, weight loss, missing belongings, or sudden changes in finances. Trust your instincts. You do not need proof to report a concern.',
        },
        {
          title: 'Your duty to report',
          content:
            'Direct care workers are expected to report suspected abuse, neglect, or exploitation. Report concerns to your supervisor and, when required, to the appropriate authorities. In Pennsylvania, suspected abuse of an older adult can be reported to the statewide elder abuse hotline at 1-800-490-8505. When in doubt, report. Reports made in good faith are protected.',
        },
      ],
      quiz: [
        {
          question: 'Which of these may be a sign of neglect?',
          options: ['A tidy, well-stocked kitchen', 'Poor hygiene and unexplained weight loss', 'A client who enjoys visitors'],
          correct: 1,
        },
        {
          question: 'You suspect, but cannot prove, that a client is being exploited. You should:',
          options: ['Wait until you have solid proof', 'Report your good-faith concern', 'Confront the family yourself'],
          correct: 1,
        },
        {
          question: 'Reports of suspected abuse made in good faith are:',
          options: ['Protected', 'Grounds for firing you', 'Optional and rarely needed'],
          correct: 0,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'EVV-BASICS',
    title: 'Electronic Visit Verification (EVV) Basics',
    description: 'How and why to clock in and out correctly to keep visits compliant and payable.',
    cadence: 'one_time',
    expiresAfterDays: null,
    required: true,
    durationMinutes: 20,
    modules: {
      objectives: [
        'Explain why EVV is required',
        'Clock in and out correctly at the point of care',
        'Handle common EVV problems the right way',
      ],
      sections: [
        {
          title: 'Why EVV matters',
          content:
            'The 21st Century Cures Act requires Electronic Visit Verification for Medicaid personal care services. EVV captures who provided care, for whom, what service, where, and when the visit started and ended. Accurate EVV protects you, documents the care you gave, and is what allows the agency to be paid. Inaccurate or falsified EVV can jeopardize payment and is considered fraud.',
        },
        {
          title: 'Clocking in and out',
          content:
            'Open the app at the client’s home and clock in when the visit begins; clock out when it ends. Allow location access so the visit location can be verified. Location is captured only at clock-in and clock-out, never tracked in between. If you forget to clock in, clock in as soon as you remember and tell your coordinator so the visit can be corrected properly.',
        },
      ],
      quiz: [
        {
          question: 'EVV is required by:',
          options: ['The 21st Century Cures Act', 'Your phone carrier', 'No one. It is optional'],
          correct: 0,
        },
        {
          question: 'When is your location captured?',
          options: ['Continuously throughout your shift', 'Only at clock-in and clock-out', 'Never'],
          correct: 1,
        },
        {
          question: 'You forgot to clock in at the start of a visit. You should:',
          options: [
            'Clock in when you remember and notify your coordinator to correct it',
            'Make up start and end times that look right',
            'Skip the visit record entirely',
          ],
          correct: 0,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'CPR-FA',
    title: 'CPR & First Aid Certification',
    description: 'Hands-on CPR and first aid certification through an approved provider. Upload your card when complete.',
    cadence: 'certification',
    expiresAfterDays: 730,
    required: false,
    durationMinutes: 240,
    externalUrl: 'https://www.redcross.org/take-a-class/cpr',
    modules: {
      objectives: [
        'Recognize a cardiac or breathing emergency',
        'Complete an approved hands-on CPR/First Aid course',
        'Keep your certification current (renew before it expires)',
      ],
      sections: [
        {
          title: 'About this certification',
          content:
            'CPR and First Aid certification requires a hands-on skills check, so it must be earned through an approved in-person or blended provider such as the American Red Cross or American Heart Association.\n\nWhat to do: find and complete a class using the official resource link, provide your certification card to the agency so your record can be updated, and renew before the expiry date (certifications typically last about two years).',
        },
      ],
      quiz: [
        {
          question: 'CPR certification requires:',
          options: ['Only watching a video', 'An approved hands-on skills check', 'Nothing. Self-study is enough'],
          correct: 1,
        },
        {
          question: 'CPR/First Aid certification typically must be renewed:',
          options: ['Never', 'Every two years (before it expires)', 'Every ten years'],
          correct: 1,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'PA-611-COMPETENCY',
    title: 'Pennsylvania Chapter 611 Direct Care Worker Competency Training',
    description:
      'Chapter 611 competency training for direct care workers: your role and limits, medication assistance, personal care with dignity, safe transfers, meal support, and reporting.',
    cadence: 'semi_annual',
    expiresAfterDays: 182,
    required: true,
    durationMinutes: 60,
    modules: {
      objectives: [
        'Understand the direct care worker role and the tasks that are never permitted',
        'Assist with self administered medications without ever administering them',
        'Provide bathing, grooming, toileting, and skin care with dignity and independence',
        'Perform safe ambulation, transfers, meal preparation, and feeding assistance',
        'Report changes, incidents, and Plan of Care updates with accurate, timely documentation',
      ],
      sections: [
        {
          title: 'Role of the Direct Care Worker',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-1-role.jpg',
          imageAlt: 'A caregiver visits with an older adult at home, offering support and companionship.',
          content:
            'Direct care workers help participants remain safe, healthy, and independent in their homes. Caregivers must follow the participant’s Plan of Care, agency policies, and Chapter 611 requirements.\n\nYou may assist with approved personal care tasks only when the task is part of the participant’s Plan of Care and you have received proper training. Always respect participant dignity, privacy, independence, culture, and personal choices.\n\nNever permitted: diagnosing medical conditions, prescribing medications, administering medications, changing medication dosages, performing nursing tasks, or completing duties outside of your training.\n\nCorrect: A participant is weaker than usual and having difficulty walking. The caregiver reports the change to the agency immediately.\nIncorrect: The caregiver notices the participant is struggling but does not report it, hoping it may get better.\n\nWhen in doubt, contact the agency. Never guess about your role.',
        },
        {
          title: 'Assistance with Self Administered Medications',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-2-medications.jpg',
          imageAlt: 'Prescription medication containers and a weekly pill organizer used for self administered medication.',
          content:
            'Direct care workers may assist participants with self administered medications, but they may not administer medications.\n\nYou may help by: (1) Reminding the participant that it is time for medication. (2) Opening medication containers when requested. (3) Reading the medication label to the participant when requested. (4) Handing the medication container to the participant. (5) Helping the participant locate medication. (6) Reporting medication refusal or concerns to the agency.\n\nNever allowed: giving injections, placing medication into the participant’s mouth, deciding medication dosage, changing the medication schedule, crushing medication without authorization, administering eye drops, or giving medication directly to the participant.\n\nCorrect: The participant says they cannot open a bottle. The caregiver opens the bottle and hands it back, and the participant takes the medication independently.\nIncorrect: The caregiver removes the pills and places them into the participant’s mouth.\n\nCorrect: The participant refuses medication. The caregiver does not force the participant, and documents and reports the refusal to the agency.\nIncorrect: The caregiver argues with the participant or hides medication in food.\n\nYou assist only, and you never administer medication yourself.',
        },
        {
          title: 'Bathing, Shaving, Grooming, and Dressing',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-3-grooming.jpg',
          imageAlt: 'A caregiver assists an older adult with grooming and personal care.',
          content:
            'Bathing, shaving, grooming, and dressing must always be provided with dignity, privacy, respect, and safety. Encourage the participant to do as much as they can safely do independently, assist only where help is needed, and respect participant preferences.\n\nWays you may assist: bathing support, washing hard to reach areas, shaving assistance when permitted, brushing hair, washing the face, and helping with clothing (buttons, zippers, socks, and shoes).\n\nCorrect: The participant can wash their face and arms but needs help washing their back. The caregiver lets the participant do what they can and assists only with the back.\nIncorrect: The caregiver rushes the participant and completes every task without allowing independence.\n\nPromote independence while keeping the participant safe. Never rush personal care.',
        },
        {
          title: 'Hair, Skin, and Mouth Care',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-4-skin.jpg',
          imageAlt: 'Care supplies used for hair, skin, and mouth care.',
          content:
            'Hair, skin, and mouth care help prevent infection, discomfort, and skin breakdown.\n\nHair care may include: brushing hair, washing hair when assigned, and observing the condition of the scalp.\n\nMouth care may include brushing teeth and denture care. Watch the mouth for: bleeding gums, mouth sores, pain, odor, or difficulty eating.\n\nSkin care means keeping skin clean and dry. Watch the skin for: redness, swelling, bruising, wounds, skin tears, pressure areas, rash, or signs of infection.\n\nCorrect: While assisting with dressing, the caregiver notices redness on the participant’s heel and reports it to the agency right away.\nIncorrect: The caregiver ignores the redness because the participant says it does not hurt.\n\nSmall skin problems can become serious quickly. Never ignore a skin change; report it to the agency immediately.',
        },
        {
          title: 'Ambulation and Transfers',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-5-transfers.jpg',
          imageAlt: 'A helper steadies an older adult during a wheelchair transfer.',
          content:
            'Ambulation means helping a participant walk safely. A transfer means helping a participant move from one place or position to another, such as bed to wheelchair, wheelchair to toilet, or chair to standing.\n\nFor every transfer: follow the Plan of Care, use proper body mechanics, keep pathways clear, use equipment as directed, and use a gait belt when the Plan of Care requires one.\n\nNever do any of the following: pull a participant by the arms, rush a transfer, attempt a transfer alone when assistance is required, or attempt a transfer you are not trained to perform.\n\nCorrect: The Plan of Care requires a gait belt. The caregiver uses the gait belt and assists the participant slowly and safely.\nIncorrect: The caregiver pulls the participant up by the arms because it is faster.\n\nAn unsafe transfer can injure both the participant and the caregiver.',
        },
        {
          title: 'Toileting and Incontinence Care',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-6-toileting.jpg',
          imageAlt: 'Disposable gloves are put on before providing personal care.',
          content:
            'Toileting and incontinence care must protect participant dignity, privacy, comfort, and health.\n\nDuring toileting care: wear gloves when appropriate, provide privacy, assist with bathroom transfers when assigned, clean the skin properly, change soiled clothing or incontinence products promptly, and report any skin concerns.\n\nNever leave a participant in soiled clothing or briefs. Delays can cause discomfort, odor, infection, and skin breakdown.\n\nCorrect: The caregiver assists the participant to the bathroom, provides privacy, helps with hygiene as needed, and reports redness noticed during care.\nIncorrect: The caregiver delays care and leaves the participant in soiled clothing for an extended period.\n\nToileting care must be respectful, timely, and clean.',
        },
        {
          title: 'Meal Preparation and Feeding',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-7-meals.jpg',
          imageAlt: 'A table set with a variety of healthy dishes, including fresh salad, grilled vegetables, and fruit.',
          content:
            'Meal preparation and feeding help support participant health, energy, and independence.\n\nWhen preparing meals: follow the participant’s dietary instructions and restrictions, practice safe food handling, check dates and never serve spoiled food, respect food allergies, and prepare foods the participant can chew and swallow safely.\n\nIf the participant has a special diet (for example low sodium or diabetic): follow the dietary instructions in the Plan of Care exactly, and never add restricted ingredients.\n\nWhen assisting with eating: encourage the participant to eat independently when possible, offer small bites at a comfortable pace, stay attentive for choking risks, and never rush or force feed a participant.\n\nCorrect: The participant has a low sodium diet. The caregiver prepares the meal without added salt and follows the dietary instructions.\nIncorrect: The caregiver adds extra salt without checking the Plan of Care or contacting the agency.\n\nReport appetite changes, swallowing problems, or choking episodes to the agency.',
        },
        {
          title: 'Hand Hygiene, Documentation, and Reporting',
          imageUrl: 'https://rayhealthevv.com/training/pa611/module-8-hygiene.jpg',
          imageAlt: 'Hands are washed with soap and running water at a sink.',
          content:
            'Clean hands protect you and your participant. Perform hand hygiene at these times: before and after providing care, after removing gloves, after toileting assistance, and before preparing or serving food. Wear gloves whenever exposure to bodily fluids may occur.\n\nDocumentation must be accurate, complete, and timely. Record care during or right after your visit, never from memory days later.\n\nReport to the agency immediately: sudden weakness or confusion, falls or injuries, skin changes, medication refusals or concerns, changes in appetite or swallowing, and any new needs in the participant’s Plan of Care.\n\nIf a participant falls during your shift: make sure the participant is safe, report the incident to the agency immediately, and document exactly what happened.\n\nIf the Plan of Care changes: notify the agency so the change can be reviewed and training can be provided before you perform any new task.\n\nCorrect: A participant seems suddenly confused. The caregiver reports it to the agency the same day and documents what they observed.\nIncorrect: The caregiver waits several days and then documents the change from memory.',
        },
      ],
      note:
        'Chapter 611 requires competency verification before providing care. Completing every module and passing the knowledge check records your acknowledgement and competency evidence.',
      quiz: [
        {
          question: 'What is the primary role of a direct care worker?',
          options: ['Prescribe medications', 'Support participant independence and safety', 'Diagnose medical conditions', 'Develop treatment plans'],
          correct: 1,
        },
        {
          question: 'A caregiver may assist with self administered medications by:',
          options: ['Giving injections', 'Choosing medication dosages', 'Opening medication containers', 'Administering eye drops'],
          correct: 2,
        },
        {
          question: 'If a participant refuses medication, the caregiver should:',
          options: ['Force the participant to take it', 'Hide medication in food', 'Document and report the refusal', 'Double the next dose'],
          correct: 2,
        },
        {
          question: 'Which activity is NOT permitted?',
          options: ['Reading a medication label', 'Providing medication reminders', 'Opening a medication bottle', 'Placing medication into a participant’s mouth'],
          correct: 3,
        },
        {
          question: 'A participant asks you to give an insulin injection. What should you do?',
          options: ['Give the injection', 'Contact the agency and explain you are not authorized', 'Ask a family member to teach you', 'Watch a video and perform it'],
          correct: 1,
        },
        {
          question: 'During bathing assistance, the caregiver should:',
          options: ['Rush the participant', 'Maintain privacy and dignity', 'Leave the participant unattended', 'Ignore participant preferences'],
          correct: 1,
        },
        {
          question: 'Which is an example of proper grooming assistance?',
          options: ['Helping brush hair', 'Choosing medications', 'Ignoring hygiene', 'Diagnosing skin conditions'],
          correct: 0,
        },
        {
          question: 'When assisting with dressing, caregivers should:',
          options: ['Encourage independence when safe', 'Force clothing choices', 'Rush the participant', 'Ignore participant preferences'],
          correct: 0,
        },
        {
          question: 'While providing care, you notice redness on a participant’s heel. You should:',
          options: ['Ignore it', 'Report it to the agency', 'Cover it and say nothing', 'Wait until the next annual review'],
          correct: 1,
        },
        {
          question: 'Which is part of proper mouth care?',
          options: ['Monitoring oral hygiene', 'Prescribing toothpaste', 'Ignoring bleeding gums', 'Diagnosing infections'],
          correct: 0,
        },
        {
          question: 'What is the safest transfer technique?',
          options: ['Pulling a participant by the arms', 'Following the care plan and using approved techniques', 'Lifting however feels easiest', 'Asking the participant to jump up'],
          correct: 1,
        },
        {
          question: 'A gait belt should be used:',
          options: ['When required by the care plan', 'Only during emergencies', 'Whenever the caregiver wants', 'Never'],
          correct: 0,
        },
        {
          question: 'Ambulation assistance means:',
          options: ['Helping a participant walk safely', 'Driving participants', 'Giving medications', 'Preparing meals'],
          correct: 0,
        },
        {
          question: 'Proper toileting assistance includes:',
          options: ['Preserving dignity and privacy', 'Rushing the participant', 'Ignoring requests', 'Leaving the participant alone if unsafe'],
          correct: 0,
        },
        {
          question: 'Why is incontinence care important?',
          options: ['To prevent skin breakdown and infection', 'To reduce paperwork', 'To increase scheduling flexibility', 'To avoid meal preparation'],
          correct: 0,
        },
        {
          question: 'During personal care, gloves should be used:',
          options: ['When exposure to bodily fluids may occur', 'Never', 'Only during meal preparation', 'Only when requested'],
          correct: 0,
        },
        {
          question: 'A participant has a low sodium diet. What should the caregiver do?',
          options: ['Follow dietary instructions', 'Ignore restrictions', 'Add extra salt', 'Allow unrestricted food choices'],
          correct: 0,
        },
        {
          question: 'Safe meal preparation includes:',
          options: ['Following food safety practices', 'Serving spoiled food', 'Ignoring allergies', 'Guessing dietary restrictions'],
          correct: 0,
        },
        {
          question: 'When assisting with feeding, caregivers should:',
          options: ['Encourage independence when possible', 'Rush meals', 'Force feed participants', 'Ignore choking risks'],
          correct: 0,
        },
        {
          question: 'Hand hygiene should be performed:',
          options: ['Before and after providing care', 'Only after providing care', 'Once per shift', 'Only when hands look dirty'],
          correct: 0,
        },
        {
          question: 'A participant’s Plan of Care changes and now includes bathing assistance. What should the caregiver do?',
          options: ['Begin bathing assistance immediately without notifying anyone', 'Ask another caregiver what to do', 'Notify the agency so the change can be reviewed and training can be provided if needed', 'Refuse all services'],
          correct: 2,
        },
        {
          question: 'A participant falls during your shift. What should you do?',
          options: ['Wait until tomorrow to report it', 'Report and document the incident immediately', 'Ignore it if there is no injury', 'Ask the participant not to tell anyone'],
          correct: 1,
        },
        {
          question: 'Documentation should be:',
          options: ['Accurate, complete, and timely', 'Estimated', 'Delayed until convenient', 'Based on memory several days later'],
          correct: 0,
        },
        {
          question: 'Which change should be reported to the agency?',
          options: ['Sudden weakness or confusion', 'A participant’s favorite TV show', 'Weather conditions', 'Grocery preferences'],
          correct: 0,
        },
        {
          question: 'What is the most important responsibility of a direct care worker?',
          options: ['Follow the care plan, agency policies, and provide safe care', 'Finish tasks as quickly as possible', 'Make medical decisions independently', 'Perform duties outside of training'],
          correct: 0,
        },
      ],
    },
  },
];

async function run(): Promise<void> {
  const db = createDb();
  const repo = new LearningRepository(db);
  let created = 0;
  let existing = 0;
  try {
    for (const course of CATALOG) {
      const before = await repo.findCourseByCode(null, course.code);
      await repo.upsertCourseByCode(course);
      if (before) existing += 1;
      else created += 1;
    }
    process.stderr.write(`Learning catalog seed complete: ${created} created, ${existing} already present.\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`Learning catalog seed failed: ${message}\n`);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

void run();
