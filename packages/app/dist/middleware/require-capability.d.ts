import type { Request, Response, NextFunction } from 'express';
import { type Capability } from '@rayhealth/core';
export declare function requireCapability(capability: Capability): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=require-capability.d.ts.map