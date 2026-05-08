import { hasCapability } from '@rayhealth/core';
export function requireCapability(capability) {
    return (req, res, next) => {
        if (!req.auth || !hasCapability(req.auth.role, capability)) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=require-capability.js.map