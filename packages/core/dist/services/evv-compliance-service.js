export class EvvComplianceService {
    validate(visit) {
        const missing = [];
        const warnings = [];
        if (!visit.assignmentId)
            missing.push('service-type');
        if (!visit.caregiverId)
            missing.push('individual');
        if (!visit.clockInTime)
            missing.push('date');
        if (!visit.clockInLocation?.lat || !visit.clockInLocation?.lng) {
            missing.push('location');
        }
        else if (visit.clockInLocation.accuracy > 100) {
            warnings.push('Clock-in GPS accuracy exceeds 100m threshold');
        }
        if (!visit.clockInTime || !visit.clockOutTime)
            missing.push('time-range');
        const unique = [...new Set(missing)];
        return { valid: unique.length === 0, missingElements: unique, warnings };
    }
    isSubmittable(visit) {
        return this.validate(visit).valid;
    }
}
//# sourceMappingURL=evv-compliance-service.js.map