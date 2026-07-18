/**
 * CARC / RARC dictionary.
 *
 * 835 remittances explain money movement in codes: CAS segments carry CARCs
 * (Claim Adjustment Reason Codes) grouped under CO/PR/OA/PI/CR, and LQ/MOA
 * segments carry RARCs (Remittance Advice Remark Codes) that add payer
 * commentary. A biller reading "CO/45" should not need the X12 site open to
 * learn it means "charge exceeds fee schedule."
 *
 * This is a curated subset of the official X12 lists , the codes that
 * realistically appear on Medicaid homecare/EVV remittances , not the full
 * thousand-entry registry. Unknown codes fall back to the bare code, so an
 * exotic CARC never breaks display, it just shows undescribed.
 */

/** CAS01 group codes. */
const GROUP_LABELS: Record<string, string> = {
  CO: 'Contractual obligation',
  PR: 'Patient responsibility',
  OA: 'Other adjustment',
  PI: 'Payer-initiated reduction',
  CR: 'Correction / reversal',
};

const CARC_DESCRIPTIONS: Record<string, string> = {
  '1': 'Deductible amount',
  '2': 'Coinsurance amount',
  '3': 'Co-payment amount',
  '4': 'Procedure code inconsistent with modifier, or required modifier missing',
  '5': 'Procedure code inconsistent with place of service',
  '6': 'Procedure/revenue code inconsistent with patient age',
  '8': 'Procedure code inconsistent with provider type/specialty',
  '9': 'Diagnosis inconsistent with patient age',
  '11': 'Diagnosis inconsistent with procedure',
  '15': 'Authorization number missing, invalid, or does not apply',
  '16': 'Claim lacks information or has submission/billing error',
  '18': 'Exact duplicate claim/service',
  '22': 'Care may be covered by another payer per coordination of benefits',
  '23': 'Impact of prior payer adjudication (COB)',
  '24': 'Charges covered under a capitation agreement / managed care plan',
  '26': 'Expenses incurred prior to coverage',
  '27': 'Expenses incurred after coverage terminated',
  '29': 'Time limit for filing has expired',
  '31': 'Patient cannot be identified as our insured',
  '32': 'Our records indicate the patient is not an eligible dependent',
  '33': 'Insured has no dependent coverage',
  '34': 'Insured has no coverage for newborns',
  '39': 'Services denied at the time authorization/pre-certification was requested',
  '45': 'Charge exceeds fee schedule / maximum allowable amount',
  '49': 'Non-covered routine/screening service',
  '50': 'Non-covered service, not deemed a medical necessity by the payer',
  '51': 'Non-covered pre-existing condition service',
  '55': 'Procedure/treatment deemed experimental or investigational',
  '58': 'Treatment rendered in an inappropriate or invalid place of service',
  '59': 'Processed based on multiple/concurrent procedure rules',
  '96': 'Non-covered charge(s)',
  '97': 'Benefit for this service is included in the payment for another service already adjudicated',
  '109': 'Claim/service not covered by this payer , send to the correct payer',
  '110': 'Billing date predates service date',
  '119': 'Benefit maximum for this time period or occurrence has been reached',
  '125': 'Submission/billing error(s)',
  '131': 'Claim specific negotiated discount',
  '133': 'Decision deferred pending additional information',
  '140': 'Patient/insured health identification number and name do not match',
  '146': 'Diagnosis was invalid for the date(s) of service reported',
  '147': 'Provider contracted/negotiated rate expired or not on file',
  '150': 'Payer deems the information submitted does not support this level of service',
  '151': 'Payment adjusted , information submitted does not support this many/frequency of services',
  '167': 'Diagnosis(es) not covered',
  '170': 'Payment denied when performed by this type of provider',
  '171': 'Payment denied when performed by this type of provider in this type of facility',
  '181': 'Procedure code was invalid on the date of service',
  '182': 'Procedure modifier was invalid on the date of service',
  '183': 'Referring provider not eligible to refer this service',
  '184': 'Prescribing/ordering provider not eligible to prescribe/order this service',
  '185': 'Rendering provider not eligible to perform the service billed',
  '197': 'Precertification/authorization/notification absent',
  '198': 'Precertification/authorization exceeded',
  '199': 'Revenue code and procedure code do not match',
  '204': 'Service/equipment/drug not covered under the patient’s current benefit plan',
  '208': 'National Provider Identifier (NPI) not matched',
  '226': 'Information requested from the billing/rendering provider was not provided or was insufficient',
  '227': 'Information requested from the patient/insured was not provided or was insufficient',
  '242': 'Services not provided by network/primary care providers',
  '252': 'An attachment/other documentation is required to adjudicate this claim/service',
  '272': 'Coverage/program guidelines were not met',
  '288': 'Referral absent',
  'A1': 'Claim/service denied , at least one remark code must be provided',
  'B7': 'Provider was not certified/eligible to be paid for this procedure/service on this date of service',
  'B13': 'Previously paid , payment for this claim/service may have been provided in a previous payment',
  'B15': 'Service/procedure requires a qualifying service/procedure be received and covered',
  'B16': '‘New patient’ qualifications were not met',
};

const RARC_DESCRIPTIONS: Record<string, string> = {
  M15: 'Separately billed services/tests bundled , they are considered components of the same procedure',
  M20: 'Missing/incomplete/invalid HCPCS code',
  M51: 'Missing/incomplete/invalid procedure code(s)',
  M53: 'Missing/incomplete/invalid days or units of service',
  M62: 'Missing/incomplete/invalid treatment authorization code',
  M76: 'Missing/incomplete/invalid diagnosis or condition',
  M79: 'Missing/incomplete/invalid charge',
  M80: 'Not covered when performed during the same session/date as a previously processed service',
  M86: 'Service denied because payment already made for same/similar procedure within set time frame',
  M119: 'Missing/incomplete/invalid/deactivated/withdrawn National Drug Code (NDC)',
  MA04: 'Secondary payment cannot be considered without the identity of/payment information from the primary payer',
  MA30: 'Missing/incomplete/invalid type of bill',
  MA61: 'Missing/incomplete/invalid Social Security number',
  MA63: 'Missing/incomplete/invalid principal diagnosis',
  MA66: 'Missing/incomplete/invalid principal procedure code',
  MA92: 'Missing plan information for other insurance',
  MA120: 'Missing/incomplete/invalid CLIA certification number',
  MA130: 'Claim contains incomplete/invalid information , unprocessable, resubmit corrected claim',
  N4: 'Missing/incomplete/invalid prior insurance carrier EOB',
  N30: 'Patient ineligible for this service',
  N54: 'Claim information is inconsistent with pre-certified/authorized services',
  N56: 'Procedure code billed is not correct/valid for the services billed or the date of service billed',
  N59: 'Please refer to your provider manual for additional program and provider information',
  N95: 'This provider type/provider specialty may not bill this service',
  N115: 'Decision based on a Local Coverage Determination (LCD)',
  N130: 'Consult plan benefit documents/guidelines for information about restrictions for this service',
  N179: 'Additional information has been requested from the member',
  N216: 'Patient is not enrolled in this portion of our benefit package',
  N286: 'Missing/incomplete/invalid referring provider primary identifier',
  N290: 'Missing/incomplete/invalid rendering provider primary identifier',
  N329: 'Missing/incomplete/invalid patient birth date',
  N362: 'The number of days or units of service exceeds our acceptable maximum',
  N381: 'Consult our contractual agreement for restrictions/billing/payment information related to these charges',
  N425: 'Statutorily excluded service(s)',
  N448: 'This drug/service/supply is not included in the fee schedule or contracted/legislated fee arrangement',
  N479: 'Missing Explanation of Benefits (Coordination of Benefits or Medicare Secondary Payer)',
  N522: 'Duplicate of a claim processed, or to be processed, as a crossover claim',
};

/** Human label for a CAS01 adjustment group ('CO' → 'Contractual obligation'). */
export function adjustmentGroupLabel(group: string): string {
  return GROUP_LABELS[group.toUpperCase()] ?? group;
}

/** Description for a CARC, or null when the code isn't in the curated set. */
export function describeCarc(code: string): string | null {
  return CARC_DESCRIPTIONS[code.toUpperCase()] ?? CARC_DESCRIPTIONS[code] ?? null;
}

/** Description for a RARC, or null when the code isn't in the curated set. */
export function describeRarc(code: string): string | null {
  return RARC_DESCRIPTIONS[code.toUpperCase()] ?? null;
}
